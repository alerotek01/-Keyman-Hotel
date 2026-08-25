import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Smartphone, Banknote, Building2, Settings, CheckCircle2,
  XCircle, Clock, AlertTriangle, DollarSign, Eye, RefreshCw, Webhook,
  TrendingUp, ArrowRight, Shield
} from "lucide-react";
import {
  usePaymentProviders, useUpdateProvider,
  usePaymentTransactions, useVerifyPayment, usePaymentSummary,
  useWebhookEvents,
} from "@/hooks/usePaymentInfrastructure";

const STATUS_COLORS: Record<string, string> = {
  initiated: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  successful: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
  refunded: 'bg-purple-100 text-purple-700',
  disputed: 'bg-orange-100 text-orange-700',
};

const PROVIDER_ICONS: Record<string, any> = {
  mpesa_manual: Smartphone,
  mpesa_daraja: Smartphone,
  stripe: CreditCard,
  cash: Banknote,
  card_pos: CreditCard,
  bank_transfer: Building2,
  room_charge: Building2,
};

// ═══════════════════════════════════════════════════
// PROVIDERS CONFIG
// ═══════════════════════════════════════════════════
function ProvidersConfig() {
  const { data: providers = [], isLoading } = usePaymentProviders();
  const updateProvider = useUpdateProvider();
  const { toast } = useToast();
  const [showApiConfig, setShowApiConfig] = useState<string | null>(null);
  const [apiForm, setApiForm] = useState({ api_key: '', api_secret: '', shortcode: '', passkey: '', consumer_key: '', consumer_secret: '', callback_url: '' });

  const handleToggle = async (provider: any) => {
    await updateProvider.mutateAsync({ id: provider.id, is_active: !provider.is_active });
    toast({ title: `${provider.name} ${!provider.is_active ? 'enabled' : 'disabled'}` });
  };

  const handleSaveApi = async (provider: any) => {
    const updates: any = { id: provider.id };
    if (provider.code === 'mpesa_daraja') {
      updates.consumer_key = apiForm.consumer_key || provider.consumer_key;
      updates.consumer_secret = apiForm.consumer_secret || provider.consumer_secret;
      updates.passkey = apiForm.passkey || provider.passkey;
      updates.shortcode = apiForm.shortcode || provider.shortcode;
      updates.callback_url = apiForm.callback_url || provider.callback_url;
      updates.status = 'connected';
    } else if (provider.code === 'stripe') {
      updates.api_key_encrypted = apiForm.api_key || provider.api_key_encrypted;
      updates.api_secret_encrypted = apiForm.api_secret || provider.api_secret_encrypted;
      updates.status = 'connected';
    }
    await updateProvider.mutateAsync(updates);
    toast({ title: `${provider.name} configured!` });
    setShowApiConfig(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Payment Providers</h3>
        <p className="text-sm text-muted-foreground">Configure payment methods. Manual providers work now, API providers activate when credentials are added.</p>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map(p => {
            const Icon = PROVIDER_ICONS[p.code] || CreditCard;
            return (
              <Card key={p.id} className={p.is_active ? 'border-green-200' : 'border-gray-200 opacity-75'}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl" style={{ color: p.color || '#666' }}>{p.icon || '💳'}</div>
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-sm text-muted-foreground">{p.description}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {p.provider_type === 'manual' ? '📋 Manual' : p.provider_type === 'api' ? '🤖 API' : p.provider_type === 'pos' ? ' Terminal' : '🏦 Bank'}
                          </Badge>
                          {p.requires_verification && <Badge className="bg-amber-100 text-amber-700 text-xs">Requires verify</Badge>}
                          {p.commission_pct > 0 && <Badge variant="outline" className="text-xs">{p.commission_pct}% fee</Badge>}
                        </div>
                      </div>
                    </div>
                    <Switch checked={p.is_active} onCheckedChange={() => handleToggle(p)} />
                  </div>

                  {p.provider_type === 'api' && (
                    <div className="mt-3">
                      {p.status === 'connected' ? (
                        <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setShowApiConfig(p.id)}>
                          <Settings className="w-4 h-4 mr-1" /> Configure API
                        </Button>
                      )}
                    </div>
                  )}

                  {p.provider_type === 'manual' && p.code === 'mpesa_manual' && p.shortcode && (
                    <div className="mt-3 bg-green-50 rounded p-2 text-sm">
                      <span className="font-medium">Till/Paybill:</span> {p.shortcode}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* API Configuration Dialog */}
      <Dialog open={!!showApiConfig} onOpenChange={() => setShowApiConfig(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {providers.find(p => p.id === showApiConfig)?.name}</DialogTitle>
            <DialogDescription>Enter API credentials to enable automated payments.</DialogDescription>
          </DialogHeader>
          {(() => {
            const provider = providers.find(p => p.id === showApiConfig);
            if (!provider) return null;

            if (provider.code === 'mpesa_daraja') {
              return (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Get credentials from <a href="https://developer.safaricom.co.ke" target="_blank" className="underline">Safaricom Developer Portal</a>
                  </div>
                  <div><Label>Consumer Key</Label><Input value={apiForm.consumer_key} onChange={(e) => setApiForm({ ...apiForm, consumer_key: e.target.value })} placeholder="From Safaricom portal" /></div>
                  <div><Label>Consumer Secret</Label><Input type="password" value={apiForm.consumer_secret} onChange={(e) => setApiForm({ ...apiForm, consumer_secret: e.target.value })} /></div>
                  <div><Label>Passkey</Label><Input type="password" value={apiForm.passkey} onChange={(e) => setApiForm({ ...apiForm, passkey: e.target.value })} /></div>
                  <div><Label>Shortcode (Till/Paybill)</Label><Input value={apiForm.shortcode} onChange={(e) => setApiForm({ ...apiForm, shortcode: e.target.value })} placeholder="e.g. 174379" /></div>
                  <div><Label>Callback URL</Label><Input value={apiForm.callback_url} onChange={(e) => setApiForm({ ...apiForm, callback_url: e.target.value })} placeholder="https://yourdomain.com/api/mpesa/callback" /></div>
                  <Button className="w-full" onClick={() => handleSaveApi(provider)}>Save & Connect</Button>
                </div>
              );
            }

            if (provider.code === 'stripe') {
              return (
                <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm text-purple-800">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Get keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank" className="underline">Stripe Dashboard</a>
                  </div>
                  <div><Label>Publishable Key</Label><Input value={apiForm.api_key} onChange={(e) => setApiForm({ ...apiForm, api_key: e.target.value })} placeholder="pk_live_..." /></div>
                  <div><Label>Secret Key</Label><Input type="password" value={apiForm.api_secret} onChange={(e) => setApiForm({ ...apiForm, api_secret: e.target.value })} placeholder="sk_live_..." /></div>
                  <Button className="w-full" onClick={() => handleSaveApi(provider)}>Save & Connect</Button>
                </div>
              );
            }

            return null;
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════
function TransactionsSection() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: transactions = [], isLoading } = usePaymentTransactions(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const verifyPayment = useVerifyPayment();
  const { toast } = useToast();
  const [showReceipt, setShowReceipt] = useState<string | null>(null);

  const handleVerify = async (txId: string, action: 'verify' | 'reject') => {
    try {
      const result = await verifyPayment.mutateAsync({
        p_transaction_id: txId,
        p_action: action,
        p_notes: action === 'reject' ? 'Rejected by manager' : undefined
      });
      toast({ title: (result as any)?.message || `Payment ${action}d` });
    } catch (e: any) { toast({ title: 'Error', description: e.message }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Payment Transactions</h3>
          <p className="text-sm text-muted-foreground">All payments across all providers. Verify manual payments here.</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="processing">Pending Verify</SelectItem>
            <SelectItem value="successful">Successful</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
      transactions.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No transactions found. Payments recorded by staff will appear here.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={STATUS_COLORS[tx.status] || 'bg-gray-100'}>
                    {tx.status === 'successful' ? <CheckCircle2 className="w-3 h-3 mr-1" /> :
                     tx.status === 'failed' ? <XCircle className="w-3 h-3 mr-1" /> :
                     tx.status === 'processing' ? <Clock className="w-3 h-3 mr-1" /> : null}
                    {tx.status}
                  </Badge>
                  <div>
                    <div className="font-medium">KES {tx.amount}</div>
                    <div className="text-xs text-muted-foreground">
                      {tx.payment_providers?.icon} {tx.payment_providers?.name} • {tx.internal_reference}
                      {tx.mpesa_receipt_number && ` • Receipt: ${tx.mpesa_receipt_number}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {tx.receipt_image_url && (
                    <Button size="sm" variant="ghost" onClick={() => setShowReceipt(tx.receipt_image_url)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  {tx.status === 'processing' && tx.payment_providers?.provider_type === 'manual' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleVerify(tx.id, 'reject')}>
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => handleVerify(tx.id, 'verify')}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Verify
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {tx.payer_name && <span>Name: {tx.payer_name} • </span>}
                {tx.payer_phone && <span>Phone: {tx.payer_phone} • </span>}
                {tx.description && <span>{tx.description} • </span>}
                <span>{new Date(tx.created_at).toLocaleString()}</span>
                {tx.verified_at && <span> • Verified: {new Date(tx.verified_at).toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Receipt Viewer */}
      <Dialog open={!!showReceipt} onOpenChange={() => setShowReceipt(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
          </DialogHeader>
          {showReceipt && (
            <img src={showReceipt} alt="Receipt" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// PAYMENT SUMMARY
// ═══════════════════════════════════════════════════
function PaymentSummarySection() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: summary, isLoading } = usePaymentSummary(date, date);
  const totals = (summary as any)?.totals;
  const byProvider = (summary as any)?.by_provider || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Payment Summary</h3>
          <p className="text-sm text-muted-foreground">Daily payment breakdown by provider and status.</p>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Total Transactions</div>
                <div className="text-2xl font-bold">{totals?.total_transactions || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Successful</div>
                <div className="text-2xl font-bold text-green-600">{totals?.successful || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Pending Verify</div>
                <div className="text-2xl font-bold text-yellow-600">{totals?.pending || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Total Collected</div>
                <div className="text-2xl font-bold">KES {Number(totals?.total_amount || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          {byProvider.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">By Provider</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {byProvider.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{p.provider} ({p.status})</span>
                      <div className="flex items-center gap-4">
                        <span>{p.count} txns</span>
                        <span className="font-medium">KES {Number(p.total || 0).toLocaleString()}</span>
                        {p.commission > 0 && <span className="text-red-600">-{p.commission}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// WEBHOOK LOG
// ═══════════════════════════════════════════════════
function WebhookLogSection() {
  const { data: events = [], isLoading } = useWebhookEvents();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Webhook Events</h3>
        <p className="text-sm text-muted-foreground">Raw webhook payloads from payment providers (M-Pesa callbacks, Stripe events).</p>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
      events.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Webhook className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No webhook events yet. These will appear when API providers send callbacks.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {events.map(e => (
            <div key={e.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={e.processed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                    {e.processed ? 'Processed' : 'Pending'}
                  </Badge>
                  <span className="font-medium text-sm">{e.event_type}</span>
                  <span className="text-xs text-muted-foreground">{e.payment_providers?.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              {e.processing_error && (
                <div className="mt-1 text-xs text-red-600">Error: {e.processing_error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════
export default function PaymentProvidersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6" /> Payment Providers
        </h1>
        <p className="text-muted-foreground">
          Manage payment methods — from manual receipts to automated M-Pesa and Stripe. All providers use the same transaction system.
        </p>
      </div>

      <Tabs defaultValue="providers">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="providers"><Settings className="w-4 h-4 mr-1" /> Providers</TabsTrigger>
          <TabsTrigger value="transactions"><CreditCard className="w-4 h-4 mr-1" /> Transactions</TabsTrigger>
          <TabsTrigger value="summary"><TrendingUp className="w-4 h-4 mr-1" /> Summary</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-1" /> Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="providers"><ProvidersConfig /></TabsContent>
        <TabsContent value="transactions"><TransactionsSection /></TabsContent>
        <TabsContent value="summary"><PaymentSummarySection /></TabsContent>
        <TabsContent value="webhooks"><WebhookLogSection /></TabsContent>
      </Tabs>
    </div>
  );
}
