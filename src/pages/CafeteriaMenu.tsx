import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Minus, ShoppingCart, Send } from 'lucide-react';
import { meals, menuItems, type MenuItem } from '@/lib/cafeteria-menu';
import { cn } from '@/lib/utils';

interface CartItem extends MenuItem {
  quantity: number;
}

export default function MenuPage() {
  const { mealId } = useParams<{ mealId: string }>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [roomNumber, setRoomNumber] = useState('');
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [showOrderSummary, setShowOrderSummary] = useState(false);

  const meal = meals.find(m => m.id === mealId);
  const items = meal?.items || menuItems.filter(i => i.category === mealId);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const updateQuantity = (item: MenuItem, delta: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter(c => c.id !== item.id);
        return prev.map(c => c.id === item.id ? { ...c, quantity: newQty } : c);
      }
      if (delta > 0) return [...prev, { ...item, quantity: 1 }];
      return prev;
    });
  };

  const getQuantity = (itemId: string) => cart.find(c => c.id === itemId)?.quantity || 0;

  const buildWhatsAppUrl = () => {
    const phone = '+254721384779';
    const lines: string[] = [];
    lines.push(`🍽️ *Keyman Hotel — Cafeteria Order*`);
    lines.push('');

    if (isTakeaway) {
      lines.push(`📦 *Takeaway Order*`);
    } else if (roomNumber) {
      lines.push(`🏨 Room ${roomNumber}${guestName ? ` — ${guestName}` : ''}`);
    } else {
      lines.push(`🚶 Walk-in${guestName ? ` — ${guestName}` : ''}`);
    }

    lines.push('');
    lines.push(`*${meal?.name || mealId}*`);
    lines.push('');

    cart.forEach(item => {
      lines.push(`• ${item.name} × ${item.quantity} — KES ${(item.price * item.quantity).toLocaleString()}`);
    });

    lines.push('');
    lines.push(`*Total: KES ${total.toLocaleString()}*`);
    lines.push('');
    lines.push(`Thank you! 🙏`);

    const text = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/${phone.replace('+', '')}?text=${text}`;
  };

  if (!meal) {
    return (
      <Layout>
        <div className="min-h-[60dvh] flex items-center justify-center mt-[72px]">
          <div className="text-center">
            <h1 className="font-display text-2xl text-charcoal">Meal not found</h1>
            <Link to="/cafeteria" className="text-sm text-brass mt-4 inline-block">← Back to cafeteria</Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <section className="bg-white pt-[72px] pb-8 border-b border-charcoal/[0.04]">
        <div className="container px-4">
          <Link to="/cafeteria" className="inline-flex items-center gap-1.5 text-sm text-charcoal/40 hover:text-brass transition-colors mb-4">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to cafeteria
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl text-charcoal">{meal.name}</h1>
          <p className="text-sm text-charcoal/40 mt-1">{meal.time}</p>
        </div>
      </section>

      <section className="py-8 sm:py-12 bg-cream/30">
        <div className="container px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Menu Items */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.filter(i => i.available).map((item) => {
                  const qty = getQuantity(item.id);
                  return (
                    <div key={item.id} className="card-warm overflow-hidden">
                      {item.image && (
                        <div className="aspect-[16/9] overflow-hidden">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-charcoal text-sm">{item.name}</h3>
                            <p className="text-xs text-charcoal/40 mt-1 line-clamp-2">{item.description}</p>
                          </div>
                          <span className="text-sm font-medium text-brass whitespace-nowrap">
                            Ksh {item.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-end mt-3">
                          {qty === 0 ? (
                            <Button
                              variant="brass-outline"
                              size="sm"
                              onClick={() => updateQuantity(item, 1)}
                              className="text-xs"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item, -1)}
                                className="w-7 h-7 rounded-full border border-charcoal/10 flex items-center justify-center text-charcoal/50 hover:bg-charcoal/5 transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-sm font-medium text-charcoal w-6 text-center">{qty}</span>
                              <button
                                onClick={() => updateQuantity(item, 1)}
                                className="w-7 h-7 rounded-full bg-brass/10 flex items-center justify-center text-brass hover:bg-brass/20 transition-colors"
                              >
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
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="card-warm p-5">
                  <h3 className="font-display text-lg text-charcoal mb-4">Your Order</h3>

                  {cart.length === 0 ? (
                    <p className="text-sm text-charcoal/40 py-6 text-center">
                      Tap + on any item to add it to your order
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3 mb-4">
                        {cart.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <span className="text-charcoal/70">
                              {item.name} <span className="text-charcoal/30">×{item.quantity}</span>
                            </span>
                            <span className="font-medium text-charcoal">
                              Ksh {(item.price * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-charcoal/[0.06] pt-3 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-charcoal">Total</span>
                          <span className="font-display text-xl text-charcoal">
                            Ksh {total.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Order details */}
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="text-xs text-charcoal/40 mb-1 block">Your name</label>
                          <input
                            type="text"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="e.g. James"
                            className="w-full px-3 py-2 text-sm border border-charcoal/10 rounded-lg bg-white focus:outline-none focus:border-brass/50"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-charcoal/70 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!isTakeaway}
                              onChange={() => setIsTakeaway(false)}
                              className="accent-brass"
                            />
                            Room delivery
                          </label>
                          <label className="flex items-center gap-2 text-sm text-charcoal/70 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isTakeaway}
                              onChange={() => setIsTakeaway(true)}
                              className="accent-brass"
                            />
                            Takeaway
                          </label>
                        </div>

                        {!isTakeaway && (
                          <div>
                            <label className="text-xs text-charcoal/40 mb-1 block">Room number</label>
                            <input
                              type="text"
                              value={roomNumber}
                              onChange={(e) => setRoomNumber(e.target.value)}
                              placeholder="e.g. 101"
                              className="w-full px-3 py-2 text-sm border border-charcoal/10 rounded-lg bg-white focus:outline-none focus:border-brass/50"
                            />
                          </div>
                        )}
                      </div>

                      {/* Order via WhatsApp */}
                      <a
                        href={buildWhatsAppUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button variant="brass" className="w-full" size="lg">
                          <Send className="h-4 w-4 mr-2" />
                          Order via WhatsApp
                        </Button>
                      </a>
                      <p className="text-[10px] text-charcoal/30 text-center mt-2">
                        You&apos;ll be taken to WhatsApp to confirm your order
                      </p>
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
