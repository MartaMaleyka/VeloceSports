import { Skeleton } from '@velocesport/design-system';

export interface LoadingCardProps {
  count?: number;
}

export function LoadingCard({ count = 3 }: LoadingCardProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
