import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Layout } from '@/components/Layout';
import { BookingModal } from '@/components/BookingModal';
import { Button } from '@/components/ui/button';
import { useRoomAvailability } from '@/hooks/useRooms';
import { useHeroSlides } from '@/hooks/useCms';
import { ArrowRight, ChevronLeft, ChevronRight, Bed, Presentation, UtensilsCrossed, Car } from 'lucide-react';
import type { RoomWithAvailability } from '@/lib/types';

const BASE = 'https://uuojiyehhnhjcakgpsjd.supabase.co/storage/v1/object/public/rooms';

// Fallback hero slides (used when DB has no active slides)
const fallbackHeroSlides = [
  { image_url: `${BASE}/hero-night.webp`, alt_text: 'Keyman Hotel at night with colorful lights', caption: 'Evening ambiance' },
  { image_url: `${BASE}/hero-entrance.webp`, alt_text: 'Hotel entrance and front view', caption: 'Welcome' },
  { image_url: `${BASE}/hero-arrival.webp`, alt_text: 'Arrival and parking area', caption: 'Arrival' },
  { image_url: `${BASE}/hero-lounge.webp`, alt_text: 'Guest lounge with comfortable seating', caption: 'Guest lounge' },
  { image_url: `${BASE}/hero-single.webp`, alt_text: 'Comfortable single room interior', caption: 'Our rooms' },
  { image_url: `${BASE}/hero-twin.webp`, alt_text: 'Twin room with two beds', caption: 'Twin rooms' },
  { image_url: `${BASE}/hero-front-view.webp`, alt_text: 'Keyman Hotel front view', caption: 'Front view' },
];

// Amenity carousel data
const amenityBlocks = [
  {
    id: 'rooms',
    icon: Bed,
    eyebrow: 'Stay',
    title: 'Wake up to the hills',
    caption: 'Clean rooms with views of the Taita Hills. From KES 91/night — no hidden charges, no surprises at checkout. Single, twin, and studio options.',
    link: '/rooms',
    linkText: 'See rooms & rates',
    images: [
      { src: `${BASE}/room-single.jpg`, alt: 'Single room — clean linens and dark headboard' },
      { src: `${BASE}/single-1.jpg`, alt: 'Single room — white sheets, side table' },
      { src: `${BASE}/room-twin.jpg`, alt: 'Twin room — two beds with fresh linens' },
      { src: `${BASE}/twin-1.jpg`, alt: 'Twin room — comfortable seating' },
      { src: `${BASE}/studio-1.jpg`, alt: 'Studio suite — spacious setup' },
    ],
  },
  {
    id: 'conference',
    icon: Presentation,
    eyebrow: 'Events',
    title: 'Host with a view',
    caption: 'Taita Taveta\'s only professional conference venue. Seats 70, full AV setup, catering on request. Half-day and full-day packages.',
    link: '/conference',
    linkText: 'Book the conference hall',
    images: [
      { src: `${BASE}/conference-01.jpg`, alt: 'Conference hall — boardroom setup with white linens' },
      { src: `${BASE}/conference-1.jpg`, alt: 'Conference hall — meeting arrangement' },
      { src: `${BASE}/conference-01.jpg`, alt: 'Conference hall — boardroom setup' },
    ],
  },
  {
    id: 'cafeteria',
    icon: UtensilsCrossed,
    eyebrow: 'Dining',
    title: 'Eat like a local',
    caption: 'Kenyan favourites and continental dishes, three meals a day. Home-cooked food at honest prices — for guests and walk-ins.',
    link: '/cafeteria',
    linkText: 'View today\'s menu',
    images: [
      { src: `${BASE}/cafe.jpg`, alt: 'Cafeteria dining area' },
      { src: `${BASE}/lounge.jpg`, alt: 'Guest lounge — comfortable seating' },
      { src: `${BASE}/lounge.jpg`, alt: 'Guest lounge area' },
    ],
  },
  {
    id: 'parking',
    icon: Car,
    eyebrow: 'Convenience',
    title: 'Free parking',
    caption: 'Secure parking, no extra charge. Drive in, park, check in. Simple.',
    link: '/rooms',
    linkText: 'Book a room',
    images: [
      { src: `${BASE}/hero-arrival.webp`, alt: 'Free parking — arrival area' },
      { src: `${BASE}/hero-entrance.webp`, alt: 'Hotel entrance' },
      { src: `${BASE}/hero-arrival.webp`, alt: 'Hotel arrival and parking' },
    ],
  },
];

// Full-width amenity carousel with auto-scroll, arrows, and dots
function AmenityCarousel({ images, className }: { images: { src: string; alt: string }[]; className?: string }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIdx((p) => (p + 1) % images.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [images.length]);

  const go = (n: number) => {
    setIdx(n);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setIdx((p) => (p + 1) % images.length), 4000);
  };

  return (
    <div className={cn("relative overflow-hidden group rounded-2xl", className)}>
      {images.map((img, i) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: i === idx ? 1 : 0 }}>
          <img src={img.src} alt={img.alt} className="w-full h-full object-cover" loading="lazy" />
        </div>
      ))}
      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); go(i); }}
            className={cn("w-2 h-2 rounded-full transition-all duration-300", i === idx ? "bg-white w-5" : "bg-white/40")}
          />
        ))}
      </div>
      {/* Arrows */}
      <button
        onClick={(e) => { e.stopPropagation(); go((idx - 1 + images.length) % images.length); }}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); go((idx + 1) % images.length); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}


export default function Index() {
  const [selectedRoom, setSelectedRoom] = useState<RoomWithAvailability | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const amenitiesRef = useRef<HTMLDivElement>(null);
  const slideInterval = useRef<ReturnType<typeof setInterval>>();

  const { data: rooms, isLoading } = useRoomAvailability(null, null);
  const { data: dbSlides } = useHeroSlides();

  // Use DB slides if available, otherwise fallback to hardcoded
  const heroSlides = (dbSlides && dbSlides.length > 0)
    ? dbSlides.filter((s: any) => s.is_active !== false).map((s: any) => ({
        src: s.image_url,
        alt: s.alt_text || s.caption || 'Hotel image',
        caption: s.caption || '',
      }))
    : fallbackHeroSlides.map(s => ({ src: s.image_url, alt: s.alt_text, caption: s.caption }));

  // Auto-advance hero carousel
  useEffect(() => {
    slideInterval.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(slideInterval.current);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    clearInterval(slideInterval.current);
    slideInterval.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
  };

  const handleBookRoom = (room: RoomWithAvailability) => {
    setSelectedRoom(room);
    setBookingOpen(true);
  };

  return (
    <Layout>
      {/* Hero Carousel */}
      <section className="relative h-[85dvh] min-h-[500px] flex items-center overflow-hidden">
        {heroSlides.map((slide, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === currentSlide ? 1 : 0 }}
          >
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
              style={{ backgroundImage: `url(${slide.src})` }}
            />
            <div className="absolute inset-0 bg-charcoal/50" />
          </div>
        ))}

        {/* Hero copy — Taita Hills as the hook */}
        <div className="relative z-10 container text-center text-cream animate-fade-in px-4">
          <span className="eyebrow text-brass-light/60">Mwatate, Taita Taveta</span>
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl text-cream mt-4 leading-[1.1]">
            View
            <br />
            <span className="text-brass-light">of the Taita Hills</span>
          </h1>
          <p className="text-cream/45 text-sm sm:text-base mt-5 max-w-sm mx-auto leading-relaxed">
            Comfortable beds, honest prices, and the kind of quiet you don't find in the city.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-8">
            <Link to="/rooms">
              <Button variant="brass" size="lg">
                Book a Room
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <button
              onClick={() => amenitiesRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm text-cream/30 hover:text-cream/60 transition-colors"
            >
              See what we offer ↓
            </button>
          </div>
        </div>

        {/* Carousel controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
          <button
            onClick={() => goToSlide((currentSlide - 1 + heroSlides.length) % heroSlides.length)}
            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-cream/70 hover:bg-white/30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-2">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  i === currentSlide ? "bg-brass w-6" : "bg-cream/30"
                )}
              />
            ))}
          </div>
          <button
            onClick={() => goToSlide((currentSlide + 1) % heroSlides.length)}
            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-cream/70 hover:bg-white/30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="absolute bottom-6 right-6 z-10 hidden sm:block">
          <span className="text-[10px] tracking-[0.15em] uppercase text-cream/40">
            {heroSlides[currentSlide].caption}
          </span>
        </div>
      </section>

      {/* What We Offer — Amenity carousel blocks */}
      <section ref={amenitiesRef} className="py-16 sm:py-24 md:py-32 bg-cream/40">
        <div className="container px-4">
          <div className="text-center mb-12 sm:mb-16">
            <span className="eyebrow">What we offer</span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl text-charcoal mt-3">
              Everything in one place
            </h2>
            <p className="text-sm text-charcoal/40 mt-3 max-w-md mx-auto">
              Rooms, meals, events, and parking — at the foot of the Taita Hills.
            </p>
          </div>

          <div className="space-y-16 sm:space-y-24">
            {amenityBlocks.map((block, blockIdx) => {
              const Icon = block.icon;
              const isReversed = blockIdx % 2 === 1;
              return (
                <div
                  key={block.id}
                  className={cn(
                    "grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center",
                    isReversed && "lg:[direction:rtl]"
                  )}
                >
                  {/* Carousel */}
                  <div className={cn(isReversed && "lg:[direction:ltr]")}>
                    <AmenityCarousel images={block.images} className="aspect-[4/3] sm:aspect-[16/10]" />
                  </div>

                  {/* Text */}
                  <div className={cn("lg:[direction:ltr]", isReversed && "lg:text-right")}>
                    <div className={cn("flex items-center gap-2 mb-3", isReversed && "lg:justify-end")}>
                      <Icon className="h-4 w-4 text-brass" />
                      <span className="eyebrow">{block.eyebrow}</span>
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl md:text-3xl text-charcoal">
                      {block.title}
                    </h3>
                    <p className="text-sm text-charcoal/50 mt-3 leading-relaxed max-w-md">
                      {block.caption}
                    </p>
                    <Link
                      to={block.link}
                      className={cn(
                        "inline-flex items-center gap-1.5 mt-5 text-sm font-medium text-brass hover:text-brass-dark transition-colors",
                        isReversed && "lg:flex-row-reverse"
                      )}
                    >
                      {block.linkText}
                      <ArrowRight className={cn("h-3.5 w-3.5", isReversed && "lg:rotate-180")} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA — contrast with city */}
      <section className="py-16 sm:py-24 md:py-32 bg-charcoal text-cream relative grain-overlay">
        <div className="container text-center relative z-10 px-4">
          <h2 className="font-display text-2xl sm:text-3xl md:text-5xl text-cream">
            Tired of city hotels?
          </h2>
          <p className="text-cream/50 mt-3 sm:mt-4 max-w-md mx-auto text-sm sm:text-base">
            Come up to the hills. Cool air, quiet nights, and views that actually matter.
            Book direct for the best rates.
          </p>
          <Link to="/rooms" className="inline-block mt-6 sm:mt-8">
            <Button variant="brass" size="lg">
              Check Availability
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <BookingModal
        room={selectedRoom}
        open={bookingOpen}
        onOpenChange={setBookingOpen}
      />
    </Layout>
  );
}
