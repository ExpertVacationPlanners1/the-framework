import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const TODAY = new Date().toISOString().split('T')[0]
const MONTH_START = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

const ACCOUNT_TYPES = {
  checking:        { label: 'Checking',       icon: '🏦', asset: true,  color: '#1c3d2e' },
  savings:         { label: 'Savings',        icon: '💰', asset: true,  color: '#065f46' },
  investment:      { label: 'Investment',     icon: '📈', asset: true,  color: '#1e3a5f' },
  crypto:          { label: 'Crypto',         icon: '₿',  asset: true,  color: '#7c3d00' },
  real_estate:     { label: 'Real Estate',    icon: '🏠', asset: true,  color: '#4a1d96' },
  vehicle:         { label: 'Vehicle',        icon: '🚗', asset: true,  color: '#0369a1' },
  other_asset:     { label: 'Other Asset',    icon: '💼', asset: true,  color: '#6b7280' },
  credit_card:     { label: 'Credit Card',    icon: '💳', asset: false, color: '#dc2626' },
  loan:            { label: 'Loan',           icon: '📋', asset: false, color: '#9f1239' },
  mortgage:        { label: 'Mortgage',       icon: '🏡', asset: false, color: '#b45309' },
  other_liability: { label: 'Other Debt',     icon: '⚠️', asset: false, color: '#6b7280' },
}

const CREDIT_RANGES = [
  { min: 800, label: 'Exceptional', color: '#16a34a' },
  { min: 740, label: 'Very Good',   color: '#22c55e' },
  { min: 670, label: 'Good',        color: '#f59e0b' },
  { min: 580, label: 'Fair',        color: '#f97316' },
  { min: 0,   label: 'Poor',        color: '#dc2626' },
]

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0)
const fmtFull = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

export default function Financial() {
  const { user, settings } = useAuth()

  const [activeTab, setActiveTab] = useState('overview')
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [bills, setBills] = useState([])
  const [creditScores, setCreditScores] = useState([])
  const [budgetCats, setBudgetCats] = useState([])
  const [savingsGoals, setSavingsGoals] = useState([])
  const [budget, setBudget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Forms
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddTxn, setShowAddTxn] = useState(false)
  const [showAddBill, setShowAddBill] = useState(false)
  const [showAddCredit, setShowAddCredit] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)

  const [acctForm, setAcctForm] = useState({ name: '', account_type: 'checking', institution: '', balance: '', interest_rate: '' })
  const [txnForm, setTxnForm] = useState({ description: '', amount: '', type: 'expense', transaction_date: TODAY, merchant: '', notes: '' })
  const [billForm, setBillForm] = useState({ name: '', amount: '', due_day: '', frequency: 'monthly', category: 'subscription', autopay: false })
  const [creditForm, setCreditForm] = useState({ score: '', bureau: 'TransUnion', notes: '' })
  const [goalForm, setGoalForm] = useState({ name: '', target_amount: '', current_amount: '0', notes: '' })

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  useEffect(() => { if (user) load() }, [user])

  const load = async () => {
    setLoading(true)
    const [accts, txns, billsR, credits, cats, goals, bud] = await Promise.all([
      supabase.from('financial_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('account_type'),
      supabase.from('transactions').select('*').eq('user_id', user.id).gte('transaction_date', MONTH_START).order('transaction_date', { ascending: false }),
      supabase.from('bills').select('*').eq('user_id', user.id).eq('is_active', true).order('due_day'),
      supabase.from('credit_scores').select('*').eq('user_id', user.id).order('logged_date', { ascending: false }).limit(10),
      supabase.from('budget_categories').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('savings_goals').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('user_budget').select('*').eq('user_id', user.id).single(),
    ])
    setAccounts(accts.data || [])
    setTransactions(txns.data || [])
    setBills(billsR.data || [])
    setCreditScores(credits.data || [])
    setBudgetCats(cats.data || [])
    setSavingsGoals(goals.data || [])
    setBudget(bud.data || null)
    setLoading(false)
  }

  const addAccount = async () => {
    if (!acctForm.name || !acctForm.balance) return
    const { data } = await supabase.from('financial_accounts').insert({ user_id: user.id, ...acctForm, balance: +acctForm.balance, interest_rate: +acctForm.interest_rate || null }).select().single()
    if (data) { setAccounts(p => [...p, data]); showToast('Account added ✓') }
    setAcctForm({ name: '', account_type: 'checking', institution: '', balance: '', interest_rate: '' })
    setShowAddAccount(false)
  }

  const updateAccountBalance = async (id, bal) => {
    await supabase.from('financial_accounts').update({ balance: +bal, last_updated: TODAY }).eq('id', id)
    setAccounts(p => p.map(a => a.id === id ? { ...a, balance: +bal } : a))
    showToast('Balance updated ✓')
  }

  const addTransaction = async () => {
    if (!txnForm.description || !txnForm.amount) return
    const { data } = await supabase.from('transactions').insert({ user_id: user.id, ...txnForm, amount: +txnForm.amount }).select().single()
    if (data) { setTransactions(p => [data, ...p]); showToast('Transaction added ✓') }
    setTxnForm({ description: '', amount: '', type: 'expense', transaction_date: TODAY, merchant: '', notes: '' })
    setShowAddTxn(false)
  }

  const addBill = async () => {
    if (!billForm.name || !billForm.amount) return
    const { data } = await supabase.from('bills').insert({ user_id: user.id, ...billForm, amount: +billForm.amount, due_day: +billForm.due_day || null }).select().single()
    if (data) { setBills(p => [...p, data]); showToast('Bill added ✓') }
    setBillForm({ name: '', amount: '', due_day: '', frequency: 'monthly', category: 'subscription', autopay: false })
    setShowAddBill(false)
  }

  const markBillPaid = async (id) => {
    await supabase.from('bills').update({ last_paid: TODAY }).eq('id', id)
    setBills(p => p.map(b => b.id === id ? { ...b, last_paid: TODAY } : b))
    showToast('Bill marked paid ✓')
  }

  const addCreditScore = async () => {
    if (!creditForm.score) return
    const { data } = await supabase.from('credit_scores').insert({ user_id: user.id, ...creditForm, score: +creditForm.score }).select().single()
    if (data) { setCreditScores(p => [data, ...p]); showToast('Score logged ✓') }
    setCreditForm({ score: '', bureau: 'TransUnion', notes: '' })
    setShowAddCredit(false)
  }

  const addSavingsGoal = async () => {
    if (!goalForm.name || !goalForm.target_amount) return
    const { data } = await supabase.from('savings_goals').insert({ user_id: user.id, ...goalForm, target_amount: +goalForm.target_amount, current_amount: +goalForm.current_amount || 0 }).select().single()
    if (data) { setSavingsGoals(p => [...p, data]); showToast('Goal added ✓') }
    setGoalForm({ name: '', target_amount: '', current_amount: '0', notes: '' })
    setShowAddGoal(false)
  }

  // Computed
  const totalAssets = accounts.filter(a => a.is_asset).reduce((s, a) => s + +a.balance, 0)
  const totalLiabilities = accounts.filter(a => !a.is_asset).reduce((s, a) => s + +a.balance, 0)
  const netWorth = totalAssets - totalLiabilities
  const monthIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + +t.amount, 0)
  const monthExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + +t.amount, 0)
  const monthNet = monthIncome - monthExpenses
  const totalBillsMonthly = bills.filter(b => b.frequency === 'monthly').reduce((s, b) => s + +b.amount, 0)
  const latestCredit = creditScores[0]
  const creditRange = latestCredit ? CREDIT_RANGES.find(r => latestCredit.score >= r.min) || CREDIT_RANGES[4] : null
  const today = new Date().getDate()
  const upcomingBills = bills.filter(b => b.due_day && b.due_day >= today && b.due_day <= today + 7)
  const totalSavings = savingsGoals.reduce((s, g) => s + +g.current_amount, 0)
  const totalSavingsTarget = savingsGoals.reduce((s, g) => s + +g.target_amount, 0)

  const TABS = ['overview', 'accounts', 'transactions', 'bills', 'budget', 'goals', 'credit']

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}><div className="spinner spinner-dark" style={{ width: 28, height: 28 }} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900 }}>Financial</h1>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Net worth · Cash flow · Bills · Credit</p>
      </div>

      {/* Net Worth Hero */}
      <div className="card" style={{ background: 'linear-gradient(135deg,#0f1e35,#1e3a5f)', padding: '20px 20px 16px', border: '1px solid #93c5fd20' }}>
        <div className="eyebrow" style={{ color: '#93c5fd', marginBottom: 8 }}>💰 Net Worth</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
          <span style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(32px,8vw,48px)', fontWeight: 900, color: netWorth >= 0 ? '#22c55e' : '#f43f5e', lineHeight: 1 }}>{fmt(netWorth)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            { label: 'Assets', val: fmt(totalAssets), color: '#22c55e' },
            { label: 'Debts', val: fmt(totalLiabilities), color: '#f43f5e' },
            { label: 'This Month', val: fmt(monthNet), color: monthNet >= 0 ? '#22c55e' : '#f43f5e' },
          ].map(s => (
            <div key={s.label} style={{ padding: '8px 10px', background: 'rgba(255,255,255,.06)', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: s.color, fontFamily: "'Fraunces',serif" }}>{s.val}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3, fontFamily: "'Nunito Sans',sans-serif" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '7px 14px', borderRadius: 20, border: '1.5px solid',
            borderColor: activeTab === tab ? '#1e3a5f' : 'var(--border)',
            background: activeTab === tab ? '#1e3a5f' : 'var(--card)',
            color: activeTab === tab ? '#fff' : 'var(--text-2)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Nunito Sans',sans-serif", whiteSpace: 'nowrap'
          }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {[
              { icon: '📥', label: 'Monthly Income', val: fmt(monthIncome || +budget?.income || 0), color: '#16a34a', sub: 'this month' },
              { icon: '📤', label: 'Monthly Spend', val: fmt(monthExpenses), color: '#dc2626', sub: 'logged expenses' },
              { icon: '📄', label: 'Monthly Bills', val: fmt(totalBillsMonthly), color: '#1e3a5f', sub: `${bills.length} bills` },
              { icon: '🏆', label: 'Savings', val: fmt(totalSavings), color: '#7c3d00', sub: `of ${fmt(totalSavingsTarget)} goal` },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color, fontFamily: "'Fraunces',serif" }}>{s.val}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Upcoming bills */}
          {upcomingBills.length > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div className="eyebrow" style={{ color: '#dc2626', marginBottom: 10 }}>⚠️ Due This Week</div>
              {upcomingBills.map(bill => (
                <div key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>{bill.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Due {bill.due_day}th · {bill.frequency}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 15, fontWeight: 900, color: '#dc2626' }}>{fmtFull(bill.amount)}</p>
                    <button onClick={() => markBillPaid(bill.id)} style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>Mark paid ✓</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Credit score */}
          {latestCredit && (
            <div className="card" style={{ padding: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>💳 Credit Score</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Fraunces',serif", fontSize: 40, fontWeight: 900, color: creditRange?.color, lineHeight: 1 }}>{latestCredit.score}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: creditRange?.color, marginTop: 4 }}>{creditRange?.label}</div>
                </div>
                <div style={{ flex: 1 }}>
                  {/* Score bar */}
                  <div style={{ height: 8, background: '#f0ebe3', borderRadius: 4, marginBottom: 8, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: Math.round((latestCredit.score - 300) / 550 * 100) + '%', background: `linear-gradient(90deg,#dc2626,#f59e0b,#22c55e)`, borderRadius: 4 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                    <span>300</span><span>Poor</span><span>Fair</span><span>Good</span><span>850</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{latestCredit.bureau} · {new Date(latestCredit.logged_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACCOUNTS TAB */}
      {activeTab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Accounts ({accounts.length})</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddAccount(p => !p)}>{showAddAccount ? '✕ Cancel' : '+ Add Account'}</button>
          </div>

          {showAddAccount && (
            <div className="card" style={{ padding: 16, border: '1.5px solid var(--navy)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="input-field" placeholder="Account name" value={acctForm.name} onChange={e => setAcctForm(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 13 }} />
                <select className="input-field" value={acctForm.account_type} onChange={e => setAcctForm(p => ({ ...p, account_type: e.target.value }))} style={{ fontSize: 13 }}>
                  {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
                <input className="input-field" placeholder="Institution (optional)" value={acctForm.institution} onChange={e => setAcctForm(p => ({ ...p, institution: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" type="number" placeholder="Current balance ($)" value={acctForm.balance} onChange={e => setAcctForm(p => ({ ...p, balance: e.target.value }))} style={{ fontSize: 13 }} />
              </div>
              <button className="btn btn-primary btn-full" onClick={addAccount} style={{ fontSize: 13 }}>Add Account</button>
            </div>
          )}

          {/* Assets */}
          <div>
            <div className="eyebrow" style={{ color: '#16a34a', marginBottom: 8 }}>Assets · {fmt(totalAssets)}</div>
            {accounts.filter(a => a.is_asset).map(acct => {
              const cfg = ACCOUNT_TYPES[acct.account_type] || {}
              return (
                <div key={acct.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>{acct.name}</p>
                    {acct.institution && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{acct.institution}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 16, fontWeight: 900, color: cfg.color }}>{fmt(acct.balance)}</p>
                    <input type="number" defaultValue={acct.balance} style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', width: 80, textAlign: 'right', fontFamily: 'monospace' }}
                      onBlur={e => updateAccountBalance(acct.id, e.target.value)} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Liabilities */}
          {accounts.filter(a => !a.is_asset).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="eyebrow" style={{ color: '#dc2626', marginBottom: 8 }}>Liabilities · {fmt(totalLiabilities)}</div>
              {accounts.filter(a => !a.is_asset).map(acct => {
                const cfg = ACCOUNT_TYPES[acct.account_type] || {}
                return (
                  <div key={acct.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cfg.icon}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{acct.name}</p>
                      {acct.interest_rate && <p style={{ fontSize: 11, color: cfg.color }}>{acct.interest_rate}% APR</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 16, fontWeight: 900, color: cfg.color }}>{fmt(acct.balance)}</p>
                      <input type="number" defaultValue={acct.balance} style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', width: 80, textAlign: 'right', fontFamily: 'monospace' }}
                        onBlur={e => updateAccountBalance(acct.id, e.target.value)} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {accounts.length === 0 && !showAddAccount && (
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>No accounts yet. Add your checking, savings, investments, and debts to track your net worth.</p>
          )}
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="eyebrow">This Month</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>+{fmt(monthIncome)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>-{fmt(monthExpenses)}</span>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddTxn(p => !p)}>{showAddTxn ? '✕' : '+ Add'}</button>
          </div>

          {showAddTxn && (
            <div className="card" style={{ padding: 16, border: '1.5px solid var(--navy)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="input-field" placeholder="Description" value={txnForm.description} onChange={e => setTxnForm(p => ({ ...p, description: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" type="number" placeholder="Amount ($)" value={txnForm.amount} onChange={e => setTxnForm(p => ({ ...p, amount: e.target.value }))} style={{ fontSize: 13 }} />
                <select className="input-field" value={txnForm.type} onChange={e => setTxnForm(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 13 }}>
                  <option value="expense">💸 Expense</option>
                  <option value="income">💰 Income</option>
                  <option value="transfer">↔️ Transfer</option>
                </select>
                <input type="date" className="input-field" value={txnForm.transaction_date} onChange={e => setTxnForm(p => ({ ...p, transaction_date: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" placeholder="Merchant (optional)" value={txnForm.merchant} onChange={e => setTxnForm(p => ({ ...p, merchant: e.target.value }))} style={{ fontSize: 13, gridColumn: 'span 2' }} />
              </div>
              <button className="btn btn-primary btn-full" onClick={addTransaction} style={{ fontSize: 13 }}>Add Transaction</button>
            </div>
          )}

          {transactions.map(txn => (
            <div key={txn.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--card)', borderRadius: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: txn.type === 'income' ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {txn.type === 'income' ? '💰' : txn.type === 'transfer' ? '↔️' : '💸'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>{txn.description}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{txn.merchant || ''}{txn.merchant ? ' · ' : ''}{new Date(txn.transaction_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
              <p style={{ fontSize: 15, fontWeight: 800, color: txn.type === 'income' ? '#16a34a' : '#dc2626', fontFamily: "'Fraunces',serif" }}>
                {txn.type === 'income' ? '+' : '-'}{fmtFull(txn.amount)}
              </p>
            </div>
          ))}

          {transactions.length === 0 && !showAddTxn && (
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>No transactions logged this month. Track your spending to see where your money goes.</p>
          )}
        </div>
      )}

      {/* BILLS TAB */}
      {activeTab === 'bills' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="eyebrow">Bills & Subscriptions</div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{fmt(totalBillsMonthly)}/month total</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddBill(p => !p)}>{showAddBill ? '✕' : '+ Add Bill'}</button>
          </div>

          {showAddBill && (
            <div className="card" style={{ padding: 16, border: '1.5px solid var(--navy)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="input-field" placeholder="Bill name" value={billForm.name} onChange={e => setBillForm(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" type="number" placeholder="Amount ($)" value={billForm.amount} onChange={e => setBillForm(p => ({ ...p, amount: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" type="number" placeholder="Due day (1-31)" value={billForm.due_day} onChange={e => setBillForm(p => ({ ...p, due_day: e.target.value }))} style={{ fontSize: 13 }} />
                <select className="input-field" value={billForm.frequency} onChange={e => setBillForm(p => ({ ...p, frequency: e.target.value }))} style={{ fontSize: 13 }}>
                  {['weekly','biweekly','monthly','quarterly','annual'].map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={billForm.autopay} onChange={e => setBillForm(p => ({ ...p, autopay: e.target.checked }))} /> Autopay enabled
              </label>
              <button className="btn btn-primary btn-full" onClick={addBill} style={{ fontSize: 13 }}>Add Bill</button>
            </div>
          )}

          {/* Calendar view */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 8 }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
              const hasBill = bills.filter(b => b.due_day === day)
              const isPast = day < today
              return (
                <div key={day} style={{ aspectRatio: '1', borderRadius: 6, background: hasBill.length ? '#fef2f2' : 'var(--surface)', border: hasBill.length ? '1.5px solid #fecaca' : '1px solid transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: isPast ? .5 : 1 }}>
                  <span style={{ fontSize: 10, fontWeight: hasBill.length ? 800 : 400, color: hasBill.length ? '#dc2626' : 'var(--text-3)', fontFamily: 'monospace' }}>{day}</span>
                  {hasBill.length > 0 && <span style={{ fontSize: 7, color: '#dc2626', fontWeight: 700 }}>${hasBill.reduce((s, b) => s + +b.amount, 0)}</span>}
                </div>
              )
            })}
          </div>

          {/* Bill list */}
          {bills.map(bill => {
            const isPaid = bill.last_paid === TODAY
            const daysUntil = bill.due_day ? bill.due_day - today : null
            const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 3
            return (
              <div key={bill.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--card)', borderRadius: 10, border: isUrgent && !isPaid ? '1.5px solid #fecaca' : '1px solid var(--border)' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{bill.icon || '📄'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{bill.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {bill.frequency} · Due {bill.due_day ? `${bill.due_day}th` : 'TBD'}
                    {bill.autopay ? ' · Autopay ✓' : ''}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: isPaid ? '#16a34a' : '#dc2626' }}>{fmtFull(bill.amount)}</p>
                  {!isPaid ? (
                    <button onClick={() => markBillPaid(bill.id)} style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>Mark paid</button>
                  ) : (
                    <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✓ Paid today</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* BUDGET TAB */}
      {activeTab === 'budget' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="eyebrow">Monthly Budget</div>

          {/* Income vs Spend bars */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Income</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#16a34a' }}>{fmt(+budget?.income || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Fixed Expenses</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#dc2626' }}>{fmt(+budget?.fixed_costs || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Variable Expenses</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#f97316' }}>{fmt(+budget?.variable_costs || 0)}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>Net Monthly</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: (+budget?.income - +budget?.fixed_costs - +budget?.variable_costs) >= 0 ? '#16a34a' : '#dc2626', fontFamily: "'Fraunces',serif" }}>
                {fmt((+budget?.income || 0) - (+budget?.fixed_costs || 0) - (+budget?.variable_costs || 0))}
              </span>
            </div>
          </div>

          {/* Spending this month by category (from transactions) */}
          <div className="card" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>This Month's Spending</div>
            {(() => {
              const cats = {}
              transactions.filter(t => t.type === 'expense').forEach(t => {
                const cat = t.description.split(' ')[0].toLowerCase()
                cats[cat] = (cats[cat] || 0) + +t.amount
              })
              const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1])
              return sorted.length > 0 ? sorted.slice(0, 6).map(([cat, amt]) => (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{cat}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{fmtFull(amt)}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: Math.min(100, Math.round(amt / monthExpenses * 100)) + '%', background: '#dc2626' }} />
                  </div>
                </div>
              )) : <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Add transactions to see spending breakdown.</p>
            })()}
          </div>
        </div>
      )}

      {/* GOALS TAB */}
      {activeTab === 'goals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Savings Goals</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddGoal(p => !p)}>{showAddGoal ? '✕' : '+ Add Goal'}</button>
          </div>

          {showAddGoal && (
            <div className="card" style={{ padding: 16, border: '1.5px solid var(--navy)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="input-field" placeholder="Goal name" value={goalForm.name} onChange={e => setGoalForm(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" type="number" placeholder="Target amount ($)" value={goalForm.target_amount} onChange={e => setGoalForm(p => ({ ...p, target_amount: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" type="number" placeholder="Current amount ($)" value={goalForm.current_amount} onChange={e => setGoalForm(p => ({ ...p, current_amount: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" placeholder="Notes (optional)" value={goalForm.notes} onChange={e => setGoalForm(p => ({ ...p, notes: e.target.value }))} style={{ fontSize: 13 }} />
              </div>
              <button className="btn btn-primary btn-full" onClick={addSavingsGoal} style={{ fontSize: 13 }}>Add Goal</button>
            </div>
          )}

          {savingsGoals.map(goal => {
            const pct = goal.target_amount > 0 ? Math.min(100, Math.round(goal.current_amount / goal.target_amount * 100)) : 0
            const monthlyNeeded = goal.target_amount > goal.current_amount ? Math.round((goal.target_amount - goal.current_amount) / 6) : 0
            return (
              <div key={goal.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800 }}>{goal.name}</p>
                    {goal.notes && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{goal.notes}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--navy)', fontFamily: "'Fraunces',serif" }}>{pct}%</p>
                  </div>
                </div>
                <div className="progress-track" style={{ marginBottom: 8 }}>
                  <div className="progress-fill" style={{ width: pct + '%', background: pct >= 100 ? '#16a34a' : 'var(--navy)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{fmtFull(goal.current_amount)} / {fmtFull(goal.target_amount)}</span>
                  {monthlyNeeded > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmt(monthlyNeeded)}/mo needed</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input type="number" placeholder="Update amount" style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontFamily: "'Nunito Sans',sans-serif" }}
                    onBlur={async (e) => {
                      const v = parseFloat(e.target.value)
                      if (!isNaN(v) && v >= 0) {
                        await supabase.from('savings_goals').update({ current_amount: v }).eq('id', goal.id)
                        setSavingsGoals(p => p.map(g => g.id === goal.id ? { ...g, current_amount: v } : g))
                        e.target.value = ''
                        showToast('Updated ✓')
                      }
                    }} />
                  {pct >= 100 && <button style={{ padding: '7px 12px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>🎉 Complete!</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREDIT TAB */}
      {activeTab === 'credit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Credit Score History</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddCredit(p => !p)}>{showAddCredit ? '✕' : '+ Log Score'}</button>
          </div>

          {showAddCredit && (
            <div className="card" style={{ padding: 16, border: '1.5px solid var(--navy)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>Get your free score from Credit Karma, Experian, or your bank app, then log it here.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="input-field" type="number" placeholder="Score (300-850)" value={creditForm.score} onChange={e => setCreditForm(p => ({ ...p, score: e.target.value }))} min={300} max={850} style={{ fontSize: 13 }} />
                <select className="input-field" value={creditForm.bureau} onChange={e => setCreditForm(p => ({ ...p, bureau: e.target.value }))} style={{ fontSize: 13 }}>
                  <option>TransUnion</option><option>Equifax</option><option>Experian</option>
                </select>
              </div>
              <button className="btn btn-primary btn-full" onClick={addCreditScore} style={{ fontSize: 13 }}>Save Score</button>
            </div>
          )}

          {latestCredit && (
            <div className="card" style={{ padding: 20, background: `linear-gradient(135deg,${creditRange?.color}20,#fff)`, border: `2px solid ${creditRange?.color}40` }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Latest Score</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 56, fontWeight: 900, color: creditRange?.color, lineHeight: 1 }}>{latestCredit.score}</div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: creditRange?.color }}>{creditRange?.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{latestCredit.bureau}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Logged {new Date(latestCredit.logged_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
              {/* Range bar */}
              <div style={{ marginTop: 16 }}>
                <div style={{ height: 10, background: 'linear-gradient(90deg,#dc2626,#f97316,#f59e0b,#22c55e,#16a34a)', borderRadius: 5, position: 'relative', marginBottom: 4 }}>
                  <div style={{ position: 'absolute', top: -3, left: Math.round((latestCredit.score - 300) / 550 * 100) + '%', width: 16, height: 16, background: '#fff', borderRadius: '50%', border: `3px solid ${creditRange?.color}`, transform: 'translateX(-50%)', transition: 'left .5s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                  <span>300 Poor</span><span>580 Fair</span><span>670 Good</span><span>740 Very Good</span><span>800 850</span>
                </div>
              </div>
            </div>
          )}

          {/* Score history */}
          {creditScores.length > 1 && (
            <div className="card" style={{ padding: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Score History</div>
              {creditScores.map((cs, i) => {
                const prev = creditScores[i + 1]
                const change = prev ? cs.score - prev.score : 0
                const range = CREDIT_RANGES.find(r => cs.score >= r.min) || CREDIT_RANGES[4]
                return (
                  <div key={cs.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 900, color: range.color, width: 52 }}>{cs.score}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{cs.bureau} · {new Date(cs.logged_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    {change !== 0 && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: change > 0 ? '#16a34a' : '#dc2626' }}>{change > 0 ? '+' : ''}{change}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Credit improvement tips */}
          <div className="card" style={{ padding: 16, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <div className="eyebrow" style={{ color: '#0369a1', marginBottom: 10 }}>💡 Credit Building Tips</div>
            {[
              'Pay every bill on time — payment history is 35% of your score',
              'Keep credit card utilization below 30% of your limit',
              'Don\'t close old accounts — length of credit history matters',
              'Check your free score monthly via Credit Karma or your bank app',
            ].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#0369a1', flexShrink: 0 }}>→</span>
                <p style={{ fontSize: 13, color: '#1e3a5f', lineHeight: 1.5 }}>{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
