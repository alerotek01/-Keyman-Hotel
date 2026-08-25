import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGuestBreakfastOrders, useGuestAlerts, useUnreadAlertCount, useMarkAlertsRead } from '@/hooks/useBreakfast';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, Bell, ChefHat, CheckCircle2, Clock, Star, Heart, RotateCcw, MessageSquare, Utensils, Coffee, Calendar, AlertTriangle } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const kitchenStatusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Pending' },
  preparing: { color: 'bg-blue-100 text-blue-800', icon: ChefHat, label: 'Preparing' },
  ready: { color: 'bg-green-100 text-green-800', icon: CheckCircle2, label: 'Ready!' },
  served: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2, label: 'Served' },
  skipped: { color: 'bg-orange-100 text-orange-800', icon: AlertTriangle, label: 'No-Show' },
};

const orderStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-800', label: 'Confirmed' },
  preparing: { color: 'bg-blue-100 text-blue-800', label: 'Preparing' },
  ready: { color: 'bg-green-100 text-green-800', label: 'Ready' },
  delivered: { color: 'bg-emerald-100 text-emerald-800', label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
};

export default function MyMeals() {
  const { user } = useAuth();
  const [guestId, setGuestId] = useState<string | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);

  // Get guest ID
  useEffect(() => {
    if (user?.id) {
      sb.from('guests').select('id').eq('user_id', user.id).single().then(({ data }: any) => {
        if (data) setGuestId(data.id);
      });
    }
  }, [user?.id]);

  const { data: breakfastOrders, isLoading: breakfastLoading } = useGuestBreakfastOrders(guestId ?? undefined);
  const { data: alerts } = useGuestAlerts(guestId ?? undefined);
  const { data: unreadCount } = useUnreadAlertCount(guestId ?? undefined);
  const markRead = useMarkAlertsRead();

  // Restaurant orders
  const [restaurantOrders, setRestaurantOrders] = useState<any[]>([]);
  const [mealHistory, setMealHistory] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [feedbackItem, setFeedbackItem] = useState<{ orderId: string; itemId: string } | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (!guestId) return;
    loadRestaurantData();
  }, [guestId]);

  const loadRestaurantData = async () => {
    if (!guestId) return;
    
    // Active restaurant orders
    const { data: active } = await sb
      .from('restaurant_orders')
      .select('*, restaurant_order_items(*, menu_items(name, image_url, category_id, menu_categories(name)))')
      .eq('guest_id', guestId)
      .not('status', 'in', '(delivered,cancelled)')
      .order('created_at', { ascending: false });
    setRestaurantOrders(active || []);

    // Meal history
    const { data: history } = await sb.rpc('get_guest_meal_history', { p_guest_id: guestId });
    setMealHistory(history || []);

    // Favorites
    const { data: favs } = await sb.rpc('get_guest_favorites', { p_guest_id: guestId });
    setFavorites(favs || []);
  };

  const today = new Date().toISOString().split('T')[0];

  // Group breakfast orders by date
  const breakfastByDate = (breakfastOrders ?? []).reduce((acc: any, order: any) => {
    if (!acc[order.meal_date]) acc[order.meal_date] = [];
    acc[order.meal_date].push(order);
    return acc;
  }, {} as Record<string, any[]>);

  // Active breakfast orders (today + future)
  const activeBreakfast = Object.entries(breakfastByDate)
    .filter(([date]) => date >= today)
    .sort(([a], [b]) => a.localeCompare(b));

  // Past breakfast
  const pastBreakfast = Object.entries(breakfastByDate)
    .filter(([date]) => date < today)
    .sort(([a], [b]) => b.localeCompare(a));

  const handleSubmitFeedback = async () => {
    if (!feedbackItem || !guestId) return;
    setSubmittingFeedback(true);
    try {
      const { error } = await sb.rpc('submit_meal_feedback', {
        p_guest_id: guestId,
        p_menu_item_id: feedbackItem.itemId,
        p_rating: feedbackRating,
        p_comment: feedbackComment || null,
        p_order_id: feedbackItem.orderId,
      });
      if (error) throw error;
      toast.success('Thanks for your feedback! 🌟');
      setFeedbackItem(null);
      setFeedbackComment('');
      setFeedbackRating(5);
      loadRestaurantData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit');
    }
    setSubmittingFeedback(false);
  };

  const renderStars = (rating: number, interactive = false, onChange?: (r: number) => void) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && onChange?.(star)}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <Star
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🍽️ My Meals</h1>
          <p className="text-sm text-muted-foreground">Orders, history, feedback & re-order</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAlerts(!showAlerts)} className="relative">
          <Bell className="h-4 w-4" />
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* Alerts */}
      {showAlerts && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Notifications</CardTitle>
              {(unreadCount ?? 0) > 0 && (
                <Button variant="ghost" size="sm" onClick={() => guestId && markRead.mutate(guestId)} className="text-xs h-7">
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-60 overflow-y-auto">
            {alerts?.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No notifications</p>
            ) : (
              alerts?.map(alert => (
                <div key={alert.id} className={`p-2 rounded text-xs ${alert.read ? 'bg-muted/30' : 'bg-primary/5 border border-primary/20'}`}>
                  <p className={`font-medium ${!alert.read ? 'text-primary' : ''}`}>{alert.title}</p>
                  <p className="text-muted-foreground mt-0.5">{alert.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active" className="text-xs">Active</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          <TabsTrigger value="favorites" className="text-xs">Favorites</TabsTrigger>
          <TabsTrigger value="breakfast" className="text-xs">B&B</TabsTrigger>
        </TabsList>

        {/* ACTIVE ORDERS */}
        <TabsContent value="active" className="space-y-3">
          {/* Restaurant orders */}
          {restaurantOrders.length === 0 && activeBreakfast.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active orders</p>
                <Link to="/guest/order"><Button variant="outline" size="sm" className="mt-2">Order Food</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {restaurantOrders.map((order: any) => {
                const config = orderStatusConfig[order.status] || orderStatusConfig.pending;
                return (
                  <Card key={order.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">#{order.order_number}</p>
                        <Badge className={config.color}>{config.label}</Badge>
                      </div>
                      {order.restaurant_order_items?.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{item.quantity}x {item.menu_items?.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold">Total: {formatCurrency(order.total)}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}

          {/* Active breakfast */}
          {activeBreakfast.map(([date, items]) => (
            <Card key={date} className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {date === today && <Badge className="bg-primary text-primary-foreground text-[10px]">Today</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {items.map((item: any) => {
                  const ks = kitchenStatusConfig[item.kitchen_status] || kitchenStatusConfig.pending;
                  const KsIcon = ks.icon;
                  return (
                    <div key={item.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <KsIcon className={`h-3 w-3 ${item.kitchen_status === 'ready' ? 'text-green-600' : item.kitchen_status === 'preparing' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                        <span className="text-sm">{item.quantity}x {item.item_name}</span>
                      </div>
                      <Badge className={`${ks.color} text-[10px]`}>{ks.label}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="space-y-3">
          {mealHistory.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <p className="text-sm">No meal history yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Group by order */}
              {(() => {
                const byOrder = mealHistory.reduce((acc: any, item: any) => {
                  if (!acc[item.order_id]) acc[item.order_id] = { ...item, items: [] };
                  acc[item.order_id].items.push(item);
                  return acc;
                }, {} as Record<string, any>);

                return Object.values(byOrder).slice(0, 20).map((order: any) => (
                  <Card key={order.order_id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs text-muted-foreground">#{order.order_number} • {order.category_name || 'Meal'}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</p>
                        </div>
                        <Badge className={orderStatusConfig[order.order_status]?.color || 'bg-gray-100'}>
                          {order.order_status}
                        </Badge>
                      </div>
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{item.quantity}x {item.item_name}</span>
                            {item.is_favorite && <Heart className="h-3 w-3 fill-red-400 text-red-400" />}
                          </div>
                          <span className="text-xs text-muted-foreground">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                      <Separator className="my-2" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">Total: {formatCurrency(order.total)}</span>
                        <div className="flex items-center gap-2">
                          {order.has_feedback ? (
                            <div className="flex items-center gap-1">
                              {renderStars(order.feedback_rating || 0)}
                              <span className="text-[10px] text-muted-foreground">Reviewed</span>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setFeedbackItem({ orderId: order.order_id, itemId: order.items[0]?.menu_item_id })}
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Review
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ));
              })()}
            </>
          )}
        </TabsContent>

        {/* FAVORITES */}
        <TabsContent value="favorites" className="space-y-3">
          {favorites.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Heart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No favorites yet</p>
                <p className="text-xs mt-1">Order food and it'll appear here for quick re-order</p>
                <Link to="/guest/order"><Button variant="outline" size="sm" className="mt-2">Order Food</Button></Link>
              </CardContent>
            </Card>
          ) : (
            favorites.map((fav: any) => (
              <Card key={fav.menu_item_id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Heart className="h-4 w-4 fill-red-400 text-red-400" />
                      <div>
                        <p className="font-medium text-sm">{fav.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fav.times_ordered}x ordered • {fav.category_name}
                        </p>
                        {fav.avg_rating && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {renderStars(Math.round(fav.avg_rating))}
                            <span className="text-[10px] text-muted-foreground">{fav.avg_rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(fav.item_price)}</p>
                      <Link to="/guest/order">
                        <Button variant="outline" size="sm" className="h-7 text-xs mt-1">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Re-order
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* BREAKFAST */}
        <TabsContent value="breakfast" className="space-y-3">
          {breakfastOrders?.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No breakfast orders</p>
                <p className="text-xs mt-1">Select B&B when booking to get breakfast</p>
                <Link to="/guest/booking"><Button variant="outline" size="sm" className="mt-2">Book B&B</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Active breakfast */}
              {activeBreakfast.map(([date, items]) => (
                <Card key={date} className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
                      {date === today && <Badge className="bg-primary text-primary-foreground text-[10px]">Today</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {items.map((item: any) => {
                      const ks = kitchenStatusConfig[item.kitchen_status] || kitchenStatusConfig.pending;
                      const KsIcon = ks.icon;
                      return (
                        <div key={item.id} className={`flex items-center justify-between p-2 rounded ${
                          item.kitchen_status === 'ready' ? 'bg-green-50 dark:bg-green-950' :
                          item.kitchen_status === 'preparing' ? 'bg-blue-50 dark:bg-blue-950' : ''
                        }`}>
                          <div className="flex items-center gap-2">
                            <KsIcon className={`h-3 w-3 ${item.kitchen_status === 'ready' ? 'text-green-600' : item.kitchen_status === 'preparing' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                            <div>
                              <span className="text-sm font-medium">{item.quantity}x {item.item_name}</span>
                              <p className="text-[10px] text-muted-foreground font-mono">{item.verification_code}</p>
                            </div>
                          </div>
                          <Badge className={`${ks.color} text-[10px]`}>{ks.label}</Badge>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}

              {/* Past breakfast */}
              {pastBreakfast.length > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-2">Past breakfast orders shown in History tab</p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Feedback Modal */}
      {feedbackItem && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rate Your Meal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">Rating:</span>
              {renderStars(feedbackRating, true, setFeedbackRating)}
              <span className="text-xs text-muted-foreground">({feedbackRating}/5)</span>
            </div>
            <Textarea
              placeholder="Tell us about your meal... (optional)"
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setFeedbackItem(null)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmitFeedback} disabled={submittingFeedback}>
                {submittingFeedback ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
