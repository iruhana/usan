import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import {
  isPublicDataConfigured,
  lookupGovernmentBusinessStatus,
  queryGovernmentPublicData,
} from '../../public-data/public-data-manager'
import {
  isTaxConfigured,
  listHometaxEvidence,
  lookupTaxBusinessStatus,
} from '../../tax/tax-manager'

export const definitions: ProviderTool[] = [
  {
    name: 'government_public_data_query',
    description: 'Configured Government24 / data.go.kr route query',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative or absolute endpoint path' },
        method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method' },
        query: { type: 'object', description: 'Query-string parameters' },
        body: { type: 'object', description: 'Optional JSON body for POST requests' },
        responseType: { type: 'string', enum: ['json', 'text'], description: 'Preferred response parsing mode' },
      },
    },
  },
  {
    name: 'government_business_status',
    description: 'Lookup Korean business registration status via configured public-data route',
    parameters: {
      type: 'object',
      properties: {
        businessNumbers: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of 10-digit business registration numbers',
        },
        pathOverride: { type: 'string', description: 'Optional endpoint override path' },
      },
      required: ['businessNumbers'],
    },
  },
  {
    name: 'tax_business_status_lookup',
    description: 'Lookup business status via configured Barobill-compatible route',
    parameters: {
      type: 'object',
      properties: {
        businessNumbers: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of 10-digit business registration numbers',
        },
        pathOverride: { type: 'string', description: 'Optional endpoint override path' },
      },
      required: ['businessNumbers'],
    },
  },
  {
    name: 'tax_hometax_evidence',
    description: 'Read Hometax sales or purchase evidence via configured Barobill-compatible route',
    parameters: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'Start date, usually YYYY-MM-DD' },
        toDate: { type: 'string', description: 'End date, usually YYYY-MM-DD' },
        businessNumber: { type: 'string', description: 'Optional focal business registration number' },
        counterpartyNumber: { type: 'string', description: 'Optional counterparty business number' },
        direction: { type: 'string', enum: ['all', 'sales', 'purchase'] },
        documentType: { type: 'string', enum: ['all', 'tax-invoice', 'cash-receipt'] },
        page: { type: 'number', description: 'Page number starting from 1' },
        pageSize: { type: 'number', description: 'Page size' },
        pathOverride: { type: 'string', description: 'Optional endpoint override path' },
      },
    },
  },
]

const notConfiguredGovernment = {
  error: 'Government24 / public data route is not configured. Open Settings and connect a data.go.kr service first.',
}

const notConfiguredTax = {
  error: 'Hometax / Barobill route is not configured. Open Settings and connect a tax service first.',
}

export const handlers: Record<string, ToolHandler> = {
  async government_public_data_query(args) {
    if (!isPublicDataConfigured()) {
      return notConfiguredGovernment
    }

    return queryGovernmentPublicData({
      path: typeof args.path === 'string' ? args.path : undefined,
      method: args.method === 'POST' ? 'POST' : 'GET',
      query: typeof args.query === 'object' && args.query ? (args.query as Record<string, string | number | boolean | null | undefined>) : undefined,
      body: typeof args.body === 'object' ? args.body : undefined,
      responseType: args.responseType === 'text' ? 'text' : 'json',
    })
  },

  async government_business_status(args) {
    if (!isPublicDataConfigured()) {
      return notConfiguredGovernment
    }

    return {
      businesses: await lookupGovernmentBusinessStatus({
        businessNumbers: Array.isArray(args.businessNumbers)
          ? args.businessNumbers.filter((item): item is string => typeof item === 'string')
          : [],
        pathOverride: typeof args.pathOverride === 'string' ? args.pathOverride : undefined,
      }),
    }
  },

  async tax_business_status_lookup(args) {
    if (!isTaxConfigured()) {
      return notConfiguredTax
    }

    return {
      businesses: await lookupTaxBusinessStatus({
        businessNumbers: Array.isArray(args.businessNumbers)
          ? args.businessNumbers.filter((item): item is string => typeof item === 'string')
          : [],
        pathOverride: typeof args.pathOverride === 'string' ? args.pathOverride : undefined,
      }),
    }
  },

  async tax_hometax_evidence(args) {
    if (!isTaxConfigured()) {
      return notConfiguredTax
    }

    return {
      evidence: await listHometaxEvidence({
        fromDate: typeof args.fromDate === 'string' ? args.fromDate : undefined,
        toDate: typeof args.toDate === 'string' ? args.toDate : undefined,
        businessNumber: typeof args.businessNumber === 'string' ? args.businessNumber : undefined,
        counterpartyNumber:
          typeof args.counterpartyNumber === 'string' ? args.counterpartyNumber : undefined,
        direction:
          args.direction === 'sales' || args.direction === 'purchase' ? args.direction : 'all',
        documentType:
          args.documentType === 'tax-invoice' || args.documentType === 'cash-receipt'
            ? args.documentType
            : 'all',
        page: typeof args.page === 'number' ? args.page : undefined,
        pageSize: typeof args.pageSize === 'number' ? args.pageSize : undefined,
        pathOverride: typeof args.pathOverride === 'string' ? args.pathOverride : undefined,
      }),
    }
  },
}
