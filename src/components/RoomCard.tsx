import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { RoomWithAvailability } from '@/lib/types';
import { Users, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const BASE = 'https://uuojiyehhnhjcakgpsjd.supabase.co/storage/v1/object/public/rooms';

const fallbackImages: Record<string, { src: string; alt: string }[]> = {
  Single: [
    { src: BASE + '/room-single.jpg', alt: 'Single room — clean linens' },
    { src: BASE + '/single-1.jpg', alt: 'Single room — dark headboard' },
    { src: BASE + '/hotel-front.png', alt: 'Hotel building exterior' },
  ],
  Twin: [
    { src: BASE + '/room-twin.jpg', alt: 'Twin room — two beds' },
    { src: BASE + '/twin-1.jpg', alt: 'Twin room — lounge area' },
    { src: BASE + '/twin-2.jpg', alt: 'Twin room — entrance view' },
  ],
  Studio: [
    { src: BASE + '/room-studio.jpg', alt: 'Studio suite — hotel exterior' },
    { src: BASE + '/studio-1.jpg', alt: 'Studio — two-bed setup' },
    { src: BASE + '/studio-2.jpg', alt: 'Studio — room interior' },
  ],
};

interface RoomCardProps {
  room: RoomWithAvailability;
  onBook: (room: RoomWithAvailability) => void;
}

export function RoomCard({ room, onBook }: RoomCardProps) {
  const typeName = room.room_types?.name || room.room_type || 'Single';

  // Prefer DB room_images, fall back to hardcoded carousel
  const dbImages = room.room_images
    ?.sort((a, b) => a.sort_order - b.sort_order)
    .map(img => ({ src: img.image_url, alt: img.alt_text || typeName + ' room' })) || [];
  const images = dbImages.length > 0 ? dbImages : (fallbackImages[typeName] || fallbackImages.Single);

  const [imgIdx, setImgIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const isAvailable = room.available_count > 0;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setImgIdx((p) => (p + 1) % images.length);
    }, 3500);
    return () => clearInterval(timerRef.current);
  }, [images.length]);

  const goImg = (n: number) => {
    setImgIdx(n);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setImgIdx((p) => (p + 1) % images.length), 3500);
  };

  const price = Number(room.room_types?.base_rate || room.base_price);

  return (
    <article className="group card-warm overflow-hidden">
      <div className="relative h-52 bg-stone-warm/30 overflow-hidden">
        {images.map((img, i) => (
          <div key={i} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: i === imgIdx ? 1 : 0 }}>
            <img src={img.src} alt={img.alt} className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.03]" loading="lazy" />
          </div>
        ))}

        {images.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageOff className="h-8 w-8 text-charcoal/20" />
          </div>
        )}

        <div className="absolute top-3 left-3 z-10">
          <span className="inline-block bg-white/90 backdrop-blur-sm text-[10px] font-medium tracking-[0.1em] uppercase text-charcoal/70 px-2.5 py-1 rounded-full">
            {typeName} Room
          </span>
        </div>

        {!isAvailable && (
          <div className="absolute top-3 right-3 z-10">
            <span className="inline-block bg-charcoal/80 backdrop-blur-sm text-[10px] font-medium tracking-[0.1em] uppercase text-cream/80 px-2.5 py-1 rounded-full">
              Sold Out
            </span>
          </div>
        )}

        {images.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); goImg((imgIdx - 1 + images.length) % images.length); }} className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); goImg((imgIdx + 1) % images.length); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <ChevronRight className="h-3 w-3" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {images.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); goImg(i); }} className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", i === imgIdx ? "bg-white w-4" : "bg-white/50")} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-5 space-y-4">
        <div>
          <h3 className="font-display text-lg text-charcoal">Room {room.room_number}</h3>
          <p className="text-charcoal/45 text-sm mt-1 leading-relaxed line-clamp-2">
            {room.room_types?.description || 'Comfortable and well-appointed room.'}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-charcoal/40">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-brass/60" />
            <span>Up to {room.room_types?.max_occupancy || 2} guests</span>
          </div>
          <span className="text-charcoal/15">·</span>
          <span>Free parking</span>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-charcoal/[0.04]">
          <div>
            <span className="font-display text-xl text-charcoal">{formatCurrency(price)}</span>
            <span className="text-charcoal/35 text-xs"> /night</span>
          </div>
          <Button variant="brass" size="sm" onClick={() => onBook(room)} disabled={!isAvailable}>
            {isAvailable ? 'Book' : 'Unavailable'}
          </Button>
        </div>
      </div>
    </article>
  );
}
