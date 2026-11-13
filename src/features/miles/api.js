import { serviceClient } from '../../lib/services'

const { call } = serviceClient('miles')

// OutSystems leaves out attributes that hold their default value (0, '' or an
// empty list), so a new customer's balance arrives as a missing field. Fill
// those back in here so the screens never see undefined.
export function toMiles(data = {}) {
  return {
    customerId: data.customerId ?? '',
    balance: data.balance ?? 0,
    transactions: (data.transactions ?? []).map((t) => ({
      id: t.id,
      transactionType: t.transactionType ?? '',
      miles: t.miles ?? 0,
      source: t.source ?? '',
      reference: t.reference ?? '',
      description: t.description ?? '',
      createdOn: t.createdOn,
    })),
  }
}

export function toReward(r = {}) {
  return {
    rewardCode: r.rewardCode ?? '',
    name: r.name ?? '',
    description: r.description ?? '',
    rewardType: r.rewardType ?? '',
    milesCost: r.milesCost ?? 0,
    cashValue: r.cashValue ?? 0,
  }
}

export const MilesApi = {
  getMyMiles: async () => toMiles(await call('GET', 'GetMyMiles')),

  getRewards: async () => {
    const list = await call('GET', 'GetRewards')
    return (Array.isArray(list) ? list : []).map(toReward)
  },

  sync: async () => {
    const r = await call('POST', 'SyncMiles')
    return {
      newTransactions: r.newTransactions ?? 0,
      milesEarned: r.milesEarned ?? 0,
      balance: r.balance ?? 0,
    }
  },

  redeem: async (rewardCode) => {
    const r = await call('POST', 'RedeemReward', { rewardCode })
    return {
      redemptionReference: r.redemptionReference ?? '',
      rewardName: r.rewardName ?? '',
      milesDeducted: r.milesDeducted ?? 0,
      balance: r.balance ?? 0,
      cashbackAmount: r.cashbackAmount ?? 0,
      bankTransactionId: r.bankTransactionId ?? '',
    }
  },
}
