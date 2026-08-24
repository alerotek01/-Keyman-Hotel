import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, Wifi, Projector, Coffee, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConferenceMedia } from '@/hooks/useCms';

const BASE = 'https://uuojiyehhnhjcakgpsjd.supabase.co/storage/v1/object/public/rooms';

const fallbackImages = [
  { src: BASE + '/conference-01.jpg', alt: 'Conference hall — boardroom setup with white linens' },
];

const features = [
  { icon: Users, label: 'Up to 70 guests', desc: 'Flexible seating arrangements' },
  { icon: Projector, label: 'AV Equipment', desc: 'Projector, screen, and sound system' },
  { icon: Wifi, label: 'Free Wi-Fi', desc: 'High-speed internet throughout' },
  { icon: Coffee, label: 'Catering available', desc: 'Tea, coffee, and meal packages' },
];

export default function Conference() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const slideInterval = useRef<ReturnType<typeof setInterval>>();
  const { data: confMedia } = useConferenceMedia();

  // Use DB media if available, fallback to defaults
  const heroImage = confMedia?.hero_image || BASE + '/conference-01.jpg';
  const carouselImages = (confMedia?.carousel_images && confMedia.carousel_images.length > 0)
    ? confMedia.carousel_images
    : fallbackImages;
  const videoUrl = confMedia?.video_url || BASE + '/conference-video.mp4';
  const videoPoster = confMedia?.video_poster || BASE + '/conference-01.jpg';
  const videoCaption = confMedia?.video_caption || 'Video walkthrough of our conference hall setup';

  useEffect(() => {
    slideInterval.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 4000);
    return () => clearInterval(slideInterval.current);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    clearInterval(slideInterval.current);
    slideInterval.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 4000);
  };

  const toggleVideo = () => {
    if (videoRef.current) {
      if (playing) { videoRef.current.pause(); } else { videoRef.current.play(); }
      setPlaying(!playing);
    }
  };

  return (
    <Layout>
      <section className="relative min-h-[60dvh] flex items-end grain-overlay mt-[72px]">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/40 to-transparent" />
        </div>
        <div className="relative z-10 container pb-16 pt-32 px-4">
          <span className="eyebrow text-brass-light/70">Mwatate, Taita Taveta</span>
          <h1 className="font-display text-3xl sm:text-4xl md:text-6xl text-cream mt-3">Conference Hall</h1>
          <p className="text-cream/50 max-w-lg mt-4 text-sm leading-relaxed">
            Professional meeting space with views of the Taita Hills. Seats 70, full AV, catering on request.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link to="/guest/conference"><Button variant="brass" size="lg">Book This Space<ArrowRight className="h-4 w-4" /></Button></Link>
            <a href="tel:+254721384779"><Button variant="brass-outline" size="lg">Call +254 721 384 779</Button></a>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-white">
        <div className="container px-4">
          <h2 className="font-display text-xl sm:text-2xl text-charcoal mb-6 sm:mb-8">What&apos;s Included</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((f) => (
              <div key={f.label} className="p-4 sm:p-5 rounded-xl border border-charcoal/[0.06]">
                <f.icon className="h-5 w-5 text-brass mb-2 sm:mb-3" />
                <h3 className="font-medium text-charcoal text-xs sm:text-sm">{f.label}</h3>
                <p className="text-charcoal/40 text-xs mt-1 hidden sm:block">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-cream/30">
        <div className="container px-4">
          <h2 className="font-display text-xl sm:text-2xl text-charcoal mb-6 sm:mb-8">The Space</h2>
          <div className="relative rounded-2xl overflow-hidden aspect-[16/9] sm:aspect-[2/1]">
            {carouselImages.map((img, i) => (
              <div key={i} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: i === currentSlide ? 1 : 0 }}>
                <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
              </div>
            ))}
            <button onClick={() => goToSlide((currentSlide - 1 + carouselImages.length) % carouselImages.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-charcoal/60 hover:bg-white transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => goToSlide((currentSlide + 1) % carouselImages.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-charcoal/60 hover:bg-white transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {carouselImages.map((_, i) => (
                <button key={i} onClick={() => goToSlide(i)} className={cn("w-2 h-2 rounded-full transition-all duration-300", i === currentSlide ? "bg-brass w-6" : "bg-white/50")} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-white">
        <div className="container px-4">
          <h2 className="font-display text-xl sm:text-2xl text-charcoal mb-6 sm:mb-8">See It In Action</h2>
          <div className="relative rounded-2xl overflow-hidden aspect-video bg-charcoal">
            <video ref={videoRef} className="w-full h-full object-cover" poster={videoPoster} muted loop playsInline>
              <source src={videoUrl} type="video/mp4" />
            </video>
            <button onClick={toggleVideo} className="absolute inset-0 flex items-center justify-center group">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                {playing ? <Pause className="h-6 w-6 sm:h-8 sm:w-8 text-charcoal" /> : <Play className="h-6 w-6 sm:h-8 sm:w-8 text-charcoal ml-1" />}
              </div>
            </button>
          </div>
          <p className="text-center text-xs text-charcoal/40 mt-4">{videoCaption}</p>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-charcoal text-cream">
        <div className="container text-center px-4">
          <h2 className="font-display text-2xl sm:text-3xl">Book the venue</h2>
          <p className="text-cream/40 mt-3 max-w-md mx-auto text-sm">Call or WhatsApp for pricing. Custom packages for half-day and full-day events.</p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <a href="tel:+254721384779"><Button variant="brass" size="lg">Call +254 721 384 779</Button></a>
            <a href="https://wa.me/254721384779" target="_blank" rel="noopener noreferrer"><Button variant="brass-outline" size="lg">WhatsApp Us</Button></a>
          </div>
        </div>
      </section>
    </Layout>
  );
}
