/**
 * System Monitor — periodic CPU/RAM/Disk/Battery/Network collection.
 * Uses PowerShell Get-CimInstance (same pattern as existing runPS).
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { SystemMetrics, ProcessInfo, ActiveWindowInfo } from '@shared/types/infrastructure'
import { eventBus } from './event-bus'

const execFileAsync = promisify(execFile)

const DEFAULT_INTERVAL = 5000
const MIN_INTERVAL = 1000
const MAX_INTERVAL = 60000

async function runPS(script: string): Promise<string> {
  const { stdout } = await execFileAsync('powershell', [
    '-NoProfile', '-NonInteractive', '-Command', script,
  ], { timeout: 10000, windowsHide: true })
  return stdout.trim()
}

async function collectMetrics(): Promise<SystemMetrics> {
  const script = `
$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$cores = (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors
$mem = Get-CimInstance Win32_OperatingSystem
$disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select DeviceID,Size,FreeSpace
$bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select EstimatedChargeRemaining,BatteryStatus
$net = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue | Measure-Object -Property BytesReceivedPersec,BytesSentPersec -Sum
@{
  cpu = @{ usage = [math]::Round($cpu, 1); cores = $cores }
  memory = @{
    total = [math]::Round($mem.TotalVisibleMemorySize / 1024, 0)
    used = [math]::Round(($mem.TotalVisibleMemorySize - $mem.FreePhysicalMemory) / 1024, 0)
    percent = [math]::Round(($mem.TotalVisibleMemorySize - $mem.FreePhysicalMemory) / $mem.TotalVisibleMemorySize * 100, 1)
  }
  disk = @($disks | ForEach-Object {
    $total = [math]::Round($_.Size / 1GB, 1)
    $free = [math]::Round($_.FreeSpace / 1GB, 1)
    @{ drive = $_.DeviceID; total = $total; free = $free; percent = if($total -gt 0){[math]::Round(($total - $free) / $total * 100, 1)}else{0} }
  })
  battery = if($bat) { @{ percent = $bat.EstimatedChargeRemaining; charging = ($bat.BatteryStatus -eq 2) } } else { $null }
  network = @{
    bytesIn = ($net | Where-Object Property -eq 'BytesReceivedPersec').Sum
    bytesOut = ($net | Where-Object Property -eq 'BytesSentPersec').Sum
  }
} | ConvertTo-Json -Depth 4 -Compress`

  const raw = await runPS(script)
  const data = JSON.parse(raw)
  return {
    cpu: { usage: data.cpu.usage ?? 0, cores: data.cpu.cores ?? 1 },
    memory: { total: data.memory.total ?? 0, used: data.memory.used ?? 0, percent: data.memory.percent ?? 0 },
    disk: Array.isArray(data.disk) ? data.disk : [data.disk].filter(Boolean),
    battery: data.battery ?? undefined,
    network: data.network ?? undefined,
    timestamp: Date.now(),
  }
}

export async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  try {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;
public class FG {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int c);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  public static string Get() {
    var h = GetForegroundWindow();
    var sb = new StringBuilder(512);
    GetWindowText(h, sb, 512);
    uint pid; GetWindowThreadProcessId(h, out pid);
    var p = Process.GetProcessById((int)pid);
    return pid + "|" + p.ProcessName + "|" + sb.ToString();
  }
}
"@
[FG]::Get()`
    const raw = await runPS(script)
    const parts = raw.split('|')
    if (parts.length < 3) return null
    return {
      pid: parseInt(parts[0], 10),
      processName: parts[1],
      title: parts.slice(2).join('|'),
    }
  } catch {
    return null
  }
}

export async function getProcesses(limit = 15): Promise<ProcessInfo[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(Number(limit)) || 15, 100))
  try {
    const script = `
Get-Process | Sort-Object CPU -Descending | Select-Object -First ${safeLimit} Id,ProcessName,@{N='Cpu';E={[math]::Round($_.CPU,1)}},@{N='Mem';E={[math]::Round($_.WorkingSet64/1MB,0)}},MainWindowTitle |
  ConvertTo-Json -Compress`
    const raw = await runPS(script)
    const data = JSON.parse(raw)
    const arr = Array.isArray(data) ? data : [data]
    return arr.map((p: Record<string, unknown>) => ({
      pid: p.Id as number,
      name: p.ProcessName as string,
      cpu: (p.Cpu as number) ?? 0,
      memory: (p.Mem as number) ?? 0,
      windowTitle: (p.MainWindowTitle as string) || undefined,
    }))
  } catch {
    return []
  }
}

export class SystemMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private latest: SystemMetrics | null = null
  private intervalMs: number = DEFAULT_INTERVAL

  start(intervalMs?: number): void {
    if (this.timer) return
    this.intervalMs = this.toSafeInterval(intervalMs ?? DEFAULT_INTERVAL)
    this.tick()
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getLatest(): SystemMetrics | null {
    return this.latest
  }

  isRunning(): boolean {
    return this.timer !== null
  }

  setIntervalMs(intervalMs: number): void {
    const nextInterval = this.toSafeInterval(intervalMs)
    if (nextInterval === this.intervalMs) return
    this.intervalMs = nextInterval

    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  getIntervalMs(): number {
    return this.intervalMs
  }

  destroy(): void {
    this.stop()
    this.latest = null
  }

  private async tick(): Promise<void> {
    try {
      this.latest = await collectMetrics()
      eventBus.emit('system.metrics', this.latest as unknown as Record<string, unknown>, 'system-monitor')
    } catch {
      // Silently skip failed collection
    }
  }

  private toSafeInterval(raw: number): number {
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_INTERVAL
    return Math.min(Math.max(Math.floor(raw), MIN_INTERVAL), MAX_INTERVAL)
  }
}

/** Singleton instance */
export const systemMonitor = new SystemMonitor()
