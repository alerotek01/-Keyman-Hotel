import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-charcoal text-cream/70">
      <div className="container py-12 sm:py-16 px-4">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-12 gap-8 sm:gap-10">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-2 md:col-span-5 space-y-4">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-xl sm:text-2xl text-cream">Keyman</span>
              <span className="text-[9px] sm:text-[10px] font-medium tracking-[0.2em] uppercase text-brass-light">Hotel</span>
            </div>
            <p className="text-xs sm:text-sm text-cream/50 max-w-xs leading-relaxed">
              A considered stay at the foot of the Taita Hills. Thoughtful rooms, unhurried service,
              and the kind of quiet that lets you actually rest.
            </p>
            <div className="divider-brass mt-4 sm:mt-6" />
          </div>

          {/* Contact */}
          <div className="col-span-2 sm:col-span-1 md:col-span-4 space-y-4">
            <h4 className="text-[10px] sm:text-xs font-medium tracking-[0.15em] uppercase text-brass-light">
              Reach Us
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-3.5 w-3.5 text-brass-light/60 mt-0.5 shrink-0" />
                <span>Mwatate, Taita Taveta</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="h-3.5 w-3.5 text-brass-light/60 mt-0.5 shrink-0" />
                <a href="tel:+254721384779" className="hover:text-cream transition-colors">+254 721 384 779</a>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="h-3.5 w-3.5 text-brass-light/60 mt-0.5 shrink-0" />
                <a href="mailto:info@keymanhotel.co.ke" className="hover:text-cream transition-colors">info@keymanhotel.co.ke</a>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div className="col-span-2 sm:col-span-1 md:col-span-3 space-y-4">
            <h4 className="text-[10px] sm:text-xs font-medium tracking-[0.15em] uppercase text-brass-light">
              Explore
            </h4>
            <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link to="/rooms" className="text-cream/50 hover:text-cream transition-colors duration-300">
                  Rooms & Suites
                </Link>
              </li>
              <li>
                <Link to="/conference" className="text-cream/50 hover:text-cream transition-colors duration-300">
                  Conference Hall
                </Link>
              </li>
              <li>
                <Link to="/cafeteria" className="text-cream/50 hover:text-cream transition-colors duration-300">
                  Cafeteria
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-cream/50 hover:text-cream transition-colors duration-300">
                  Staff Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-cream/[0.06] flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <p className="text-[10px] sm:text-xs text-cream/30">
            © {new Date().getFullYear()} Keyman Hotel, Mwatate. All rights reserved.
          </p>
          <a href="https://www.alerotek.co.ke/studio" target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs text-cream/30 hover:text-[#3B82F6] transition-colors">
            powered by <span className="font-semibold text-[#3B82F6]">Alerotek</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
