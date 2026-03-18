/**
 * Finance tools: finance_account_summary, finance_transaction_list, finance_transfer
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import {
  getFinanceAccountSummary,
  isFinanceConfigured,
  listFinanceTransactions,
  sendFinanceTransfer,
} from '../../finance/finance-manager'

export const definitions: ProviderTool[] = [
  {
    name: 'finance_account_summary',
    description: '오픈뱅킹 또는 MyData 호환 계좌의 현재 잔액과 요약 정보를 조회합니다.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'finance_transaction_list',
    description: '오픈뱅킹 또는 MyData 호환 계좌의 거래내역을 조회합니다.',
    parameters: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: '조회 시작일 (YYYY-MM-DD)' },
        toDate: { type: 'string', description: '조회 종료일 (YYYY-MM-DD)' },
        limit: { type: 'number', description: '최대 건수 (기본 20, 최대 100)' },
        pageIndex: { type: 'number', description: '페이지 번호 (기본 1)' },
        sortOrder: { type: 'string', enum: ['A', 'D'], description: 'A=오름차순, D=내림차순' },
      },
    },
  },
  {
    name: 'finance_transfer',
    description: '오픈뱅킹 입금이체 API로 송금 요청을 생성합니다. 승인 후에만 실행해야 합니다.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'string', description: '송금 금액 (정수 문자열)' },
        summary: { type: 'string', description: '통장 표시 문구' },
        toFintechUseNum: { type: 'string', description: '수취인 핀테크이용번호' },
        toBankCode: { type: 'string', description: '수취 은행 표준코드' },
        toAccountNum: { type: 'string', description: '수취 계좌번호' },
        toAccountHolderName: { type: 'string', description: '수취인 이름(메모용)' },
      },
      required: ['amount'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async finance_account_summary() {
    if (!isFinanceConfigured()) {
      return { error: '금융 계정이 연동되지 않았습니다. 설정에서 Open Banking / MyData 계정을 먼저 연결해 주세요.' }
    }

    return getFinanceAccountSummary()
  },

  async finance_transaction_list(args) {
    if (!isFinanceConfigured()) {
      return { error: '금융 계정이 연동되지 않았습니다. 설정에서 Open Banking / MyData 계정을 먼저 연결해 주세요.' }
    }

    return {
      transactions: await listFinanceTransactions({
        fromDate: typeof args.fromDate === 'string' ? args.fromDate : undefined,
        toDate: typeof args.toDate === 'string' ? args.toDate : undefined,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
        pageIndex: typeof args.pageIndex === 'number' ? args.pageIndex : undefined,
        sortOrder: args.sortOrder === 'A' ? 'A' : 'D',
      }),
    }
  },

  async finance_transfer(args) {
    if (!isFinanceConfigured()) {
      return { error: '금융 계정이 연동되지 않았습니다. 설정에서 Open Banking / MyData 계정을 먼저 연결해 주세요.' }
    }

    return sendFinanceTransfer({
      amount: String(args.amount ?? ''),
      summary: typeof args.summary === 'string' ? args.summary : undefined,
      toFintechUseNum: typeof args.toFintechUseNum === 'string' ? args.toFintechUseNum : undefined,
      toBankCode: typeof args.toBankCode === 'string' ? args.toBankCode : undefined,
      toAccountNum: typeof args.toAccountNum === 'string' ? args.toAccountNum : undefined,
      toAccountHolderName:
        typeof args.toAccountHolderName === 'string' ? args.toAccountHolderName : undefined,
    })
  },
}
