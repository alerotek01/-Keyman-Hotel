import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useMenuCategories, useMenuItems } from '@/hooks/useMenu';
import { useCreateOrder } from '@/hooks/useRestaurantOrders';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Coffee, Utensils, Clock, Users, Plus, Minus, ShoppingCart, Send, Loader2 } from 'lucide-react';

const BASE = 'https://uuojiyehhnhjcakgpsjd.supabase.co/storage/v1/object/public/rooms';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function Cafeteria() {
  const { data: categories, isLoading: catsLoading } = useMenuCategories();
  const { data: menuItems, isLoading: itemsLoading } = useMenuItems();
  const createOrder = useCreateOrder();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [orderSource, setOrderSource] = useState<'walk_in' | 'room'>('walk_in');

  const isLoading = catsLoading || itemsLoading;

  const availableItems = menuItems?.filter(i => i.is_available) || [];
  const filteredItems = activeCategory === 'all'
    ? availableItems
    : availableItems.filter(i => i.category_id === activeCategory);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const vatAmount = Math.round(cartTotal * 0.16);
  const grandTotal = cartTotal + vatAmount;

  const updateQuantity = (item: any, delta: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter(c => c.id !== item.id);
        return prev.map(c => c.id === item.id ? { ...c, quantity: newQty } : c);
      }
      if (delta > 0) return [...prev, { id: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
      return prev;
    });
  };

  const getQuantity = (itemId: string) => cart.find(c => c.id === itemId)?.quantity || 0;

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Add items to your order first');
      return;
    }

    try {
      await createOrder.mutateAsync({
        source: 'web',
        guest_name: guestName || undefined,
        room_number: orderSource === 'room' ? parseInt(roomNumber) || undefined : undefined,
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        })),
      });

      toast.success('Order placed! Check the kitchen display for updates.');
      setCart([]);
      setGuestName('');
      setRoomNumber('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to place order');
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60dvh] flex items-center justify-center mt-[72px]">
          <Loader2 className="h-8 w-8 animate-spin text-brass" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[40dvh] flex items-end grain-overlay mt-[72px]">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${BASE}/cafe.jpg)` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/40 to-transparent" />
        </div>
        <div className="relative z-10 container pb-12 pt-24 px-4">
          <span className="eyebrow text-brass-light/70">Mwatate, Taita Taveta</span>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-cream mt-3">Our Menu</h1>
          <p className="text-cream/50 max-w-lg mt-3 text-sm leading-relaxed">
            Fresh, home-cooked meals. Order online and pick up or get room delivery.
          </p>
        </div>
      </section>

      {/* Quick Info */}
      <section className="py-8 bg-white border-b border-charcoal/[0.04]">
        <div className="container px-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Clock className="h-4 w-4 text-brass mx-auto mb-1" />
              <p className="text-xs text-charcoal/40">Breakfast 6-10am</p>
            </div>
            <div>
              <Utensils className="h-4 w-4 text-brass mx-auto mb-1" />
              <p className="text-xs text-charcoal/40">Lunch & Dinner</p>
            </div>
            <div>
              <Coffee className="h-4 w-4 text-brass mx-auto mb-1" />
              <p className="text-xs text-charcoal/40">Tea & Coffee all day</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-12 bg-cream/30">
        <div className="container px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Menu Items */}
            <div className="lg:col-span-2">
              {/* Category Filter */}
              <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeCategory === 'all' ? 'bg-brass text-white' : 'bg-white text-charcoal/60 border border-charcoal/10'
                  }`}
                >
                  All
                </button>
                {categories?.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      activeCategory === cat.id ? 'bg-brass text-white' : 'bg-white text-charcoal/60 border border-charcoal/10'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map(item => {
                  const qty = getQuantity(item.id);
                  return (
                    <div key={item.id} className="card-warm overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-charcoal text-sm">{item.name}</h3>
                            <p className="text-xs text-charcoal/40 mt-1 line-clamp-2">{item.description || 'Fresh and delicious'}</p>
                          </div>
                          <span className="text-sm font-medium text-brass whitespace-nowrap">
                            {formatCurrency(Number(item.price))}
                          </span>
                        </div>
                        <div className="flex items-center justify-end mt-3">
                          {qty === 0 ? (
                            <Button variant="brass-outline" size="sm" onClick={() => updateQuantity(item, 1)} className="text-xs">
                              <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateQuantity(item, -1)} className="w-7 h-7 rounded-full border border-charcoal/10 flex items-center justify-center text-charcoal/50 hover:bg-charcoal/5">
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-sm font-medium text-charcoal w-6 text-center">{qty}</span>
                              <button onClick={() => updateQuantity(item, 1)} className="w-7 h-7 rounded-full bg-brass/10 flex items-center justify-center text-brass hover:bg-brass/20">
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredItems.length === 0 && (
                <div className="text-center py-12">
                  <Utensils className="h-12 w-12 mx-auto text-charcoal/10 mb-4" />
                  <p className="text-charcoal/40">No items in this category</p>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="card-warm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart className="h-4 w-4 text-brass" />
                    <h3 className="font-display text-lg text-charcoal">Your Order</h3>
                  </div>

                  {cart.length === 0 ? (
                    <p className="text-sm text-charcoal/40 py-6 text-center">Tap + on any item to add it</p>
                  ) : (
                    <>
                      <div className="space-y-2 mb-4">
                        {cart.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <span className="text-charcoal/70">{item.name} <span className="text-charcoal/30">×{item.quantity}</span></span>
                            <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-charcoal/[0.06] pt-3 space-y-1 mb-4">
                        <div className="flex justify-between text-sm text-charcoal/50">
                          <span>Subtotal</span>
                          <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-charcoal/50">
                          <span>VAT (16%)</span>
                          <span>{formatCurrency(vatAmount)}</span>
                        </div>
                        <div className="flex justify-between font-display text-lg text-charcoal pt-1 border-t border-charcoal/[0.06]">
                          <span>Total</span>
                          <span className="text-brass">{formatCurrency(grandTotal)}</span>
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="space-y-3 mb-4">
                        <input
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="Your name"
                          className="w-full px-3 py-2 text-sm border border-charcoal/10 rounded-lg bg-white focus:outline-none focus:border-brass/50"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setOrderSource('walk_in')}
                            className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all ${orderSource === 'walk_in' ? 'border-brass bg-brass/5 text-brass' : 'border-charcoal/10 text-charcoal/50'}`}
                          >
                            Dine-in
                          </button>
                          <button
                            onClick={() => setOrderSource('room')}
                            className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all ${orderSource === 'room' ? 'border-brass bg-brass/5 text-brass' : 'border-charcoal/10 text-charcoal/50'}`}
                          >
                            Room Delivery
                          </button>
                        </div>
                        {orderSource === 'room' && (
                          <input
                            type="text"
                            value={roomNumber}
                            onChange={(e) => setRoomNumber(e.target.value)}
                            placeholder="Room number"
                            className="w-full px-3 py-2 text-sm border border-charcoal/10 rounded-lg bg-white focus:outline-none focus:border-brass/50"
                          />
                        )}
                      </div>

                      <Button
                        variant="brass"
                        className="w-full"
                        size="lg"
                        onClick={handleSubmitOrder}
                        disabled={createOrder.isPending}
                      >
                        {createOrder.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Place Order
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
