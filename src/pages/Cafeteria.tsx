import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ArrowRight, Coffee, Utensils, Clock, Users } from 'lucide-react';
import { meals } from '@/lib/cafeteria-menu';

const BASE = 'https://uuojiyehhnhjcakgpsjd.supabase.co/storage/v1/object/public/rooms';

export default function Cafeteria() {
  return (
    <Layout>
      {/* Hero — real cafe photo */}
      <section className="relative min-h-[60dvh] flex items-end grain-overlay mt-[72px]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${BASE}/cafe.jpg)` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/40 to-transparent" />
        </div>
        <div className="relative z-10 container pb-16 pt-32 px-4">
          <span className="eyebrow text-brass-light/70">Mwatate, Taita Taveta</span>
          <h1 className="font-display text-3xl sm:text-4xl md:text-6xl text-cream mt-3">
            Our Cafeteria
          </h1>
          <p className="text-cream/50 max-w-lg mt-4 text-sm leading-relaxed">
            Fresh, home-cooked meals with a view of the hills.
            Kenyan favourites and continental dishes — three meals a day.
          </p>
        </div>
      </section>

      {/* Quick Info */}
      <section className="py-12 bg-white border-b border-charcoal/[0.04]">
        <div className="container px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <Users className="h-5 w-5 text-brass mx-auto mb-2" />
              <p className="font-display text-xl text-charcoal">80</p>
              <p className="text-xs text-charcoal/40">Seats available</p>
            </div>
            <div>
              <Clock className="h-5 w-5 text-brass mx-auto mb-2" />
              <p className="font-display text-xl text-charcoal">3 meals</p>
              <p className="text-xs text-charcoal/40">Served daily</p>
            </div>
            <div>
              <Coffee className="h-5 w-5 text-brass mx-auto mb-2" />
              <p className="font-display text-xl text-charcoal">All day</p>
              <p className="text-xs text-charcoal/40">Tea & coffee</p>
            </div>
            <div>
              <Utensils className="h-5 w-5 text-brass mx-auto mb-2" />
              <p className="font-display text-xl text-charcoal">Buffet</p>
              <p className="text-xs text-charcoal/40">All you can eat</p>
            </div>
          </div>
        </div>
      </section>

      {/* Meal Cards — click to go to full menu */}
      <section className="py-16 sm:py-24 bg-cream/30">
        <div className="container px-4">
          <h2 className="font-display text-xl sm:text-2xl text-charcoal mb-2">Today&apos;s Menu</h2>
          <p className="text-sm text-charcoal/40 mb-8">Tap a meal to see the full menu and place an order</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {meals.map((meal) => (
              <Link
                key={meal.id}
                to={`/cafeteria/${meal.id}`}
                className="card-warm p-6 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display text-xl text-charcoal group-hover:text-brass transition-colors">
                      {meal.name}
                    </h3>
                    <p className="text-xs text-brass/70 mt-1">{meal.time}</p>
                  </div>
                  <span className="text-sm font-medium text-brass">{meal.price}</span>
                </div>
                <p className="text-sm text-charcoal/50 leading-relaxed">{meal.description}</p>
                <div className="flex items-center gap-1.5 mt-4 text-xs font-medium text-brass opacity-0 group-hover:opacity-100 transition-opacity">
                  View menu & order <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-charcoal text-cream">
        <div className="container text-center px-4">
          <h2 className="font-display text-2xl sm:text-3xl">Open to guests and walk-ins</h2>
          <p className="text-cream/40 mt-3 max-w-md mx-auto text-sm">
            No reservations needed for regular meals. For large groups or events,
            give us a heads up.
          </p>
          <div className="mt-6 sm:mt-8">
            <a href="tel:+254721384779">
              <Button variant="brass" size="lg">
                Call +254 721 384 779
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
}
