import { Card, CardContent } from '@/components/ui/card';
import { Package, Construction } from 'lucide-react';

export default function InventoryComingSoon() {
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="relative inline-block mb-4">
            <Package className="h-16 w-16 text-muted-foreground/30" />
            <Construction className="h-6 w-6 text-amber-500 absolute -top-1 -right-1" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Inventory Management</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Track stock levels for the cafeteria, housekeeping supplies, and room amenities.
          </p>
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-sm font-medium border border-amber-200">
            <Construction className="h-4 w-4" />
            Coming Soon
          </div>
          <div className="mt-6 space-y-2 text-left text-xs text-muted-foreground">
            <p className="font-medium text-sm text-foreground">Planned features:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Cafeteria ingredient tracking</li>
              <li>Housekeeping supplies inventory</li>
              <li>Room amenities stock levels</li>
              <li>Low-stock alerts & reorder notifications</li>
              <li>Supplier management</li>
              <li>Cost tracking & reporting</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
