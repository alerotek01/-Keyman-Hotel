import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterState {
  search: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  status: string[];
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  department: '',
  dateFrom: '',
  dateTo: '',
  status: [],
};

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  departments?: { value: string; label: string }[];
  statusOptions?: { value: string; label: string; color?: string }[];
  showDepartment?: boolean;
  showStatus?: boolean;
  showDateRange?: boolean;
  className?: string;
}

export function FilterBar({
  filters,
  onChange,
  departments = [
    { value: '', label: 'All Departments' },
    { value: 'Restaurant', label: 'Restaurant' },
    { value: 'Kitchen', label: 'Kitchen' },
    { value: 'Front Office', label: 'Front Office' },
    { value: 'Housekeeping', label: 'Housekeeping' },
  ],
  statusOptions = [
    { value: 'submitted', label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'explained', label: 'Explained', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'flagged', label: 'Flagged', color: 'bg-red-100 text-red-700 border-red-200' },
    { value: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { value: 'reconciled', label: 'Reconciled', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  ],
  showDepartment = true,
  showStatus = true,
  showDateRange = true,
  className,
}: FilterBarProps) {
  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.department) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    count += filters.status.length;
    return count;
  }, [filters]);

  const update = (partial: Partial<FilterState>) => {
    onChange({ ...filters, ...partial });
  };

  const toggleStatus = (value: string) => {
    const current = filters.status;
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    update({ status: next });
  };

  const clear = () => {
    onChange({ ...DEFAULT_FILTERS });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-9 h-9"
          />
        </div>

        {/* Department */}
        {showDepartment && (
          <select
            value={filters.department}
            onChange={(e) => update({ department: e.target.value })}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {departments.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        )}

        {/* Date Range */}
        {showDateRange && (
          <>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => update({ dateFrom: e.target.value })}
              className="h-9 w-[150px]"
              placeholder="From"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => update({ dateTo: e.target.value })}
              className="h-9 w-[150px]"
              placeholder="To"
            />
          </>
        )}

        {/* Clear */}
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="h-9 text-muted-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Clear ({activeCount})
          </Button>
        )}
      </div>

      {/* Status Chips */}
      {showStatus && (
        <div className="flex flex-wrap gap-1.5">
          {statusOptions.map((s) => {
            const active = filters.status.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() => toggleStatus(s.value)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  active
                    ? s.color || 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Client-side filter function for reconciliation records.
 * Pass this the raw reconciliations array and the filter state.
 */
export function filterReconciliations(recons: any[], filters: FilterState): any[] {
  return recons.filter((r) => {
    // Name search
    if (filters.search) {
      const name = r.staff_shifts?.users?.full_name?.toLowerCase() || '';
      if (!name.includes(filters.search.toLowerCase())) return false;
    }

    // Department
    if (filters.department) {
      const dept = r.staff_shifts?.departments?.name || '';
      if (dept !== filters.department) return false;
    }

    // Date range
    if (filters.dateFrom) {
      const shiftDate = r.staff_shifts?.shift_date || '';
      if (shiftDate < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const shiftDate = r.staff_shifts?.shift_date || '';
      if (shiftDate > filters.dateTo) return false;
    }

    // Status (multi-select: if any selected, record must match one)
    if (filters.status.length > 0) {
      if (!filters.status.includes(r.status)) return false;
    }

    return true;
  });
}
