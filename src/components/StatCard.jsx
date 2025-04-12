import { cn } from "../utils/cn";

export default function StatCard({ title, value, icon, className }) {
  return (
    <div className={cn(
      "relative bg-base-100 p-6 rounded-xl border border-base-content/10 shadow-sm overflow-hidden group hover:border-primary/20 transition-all duration-300 flex items-center justify-between",
      className
    )}>
      {/* Content */}
      <div className="relative z-10">
        <div className="text-sm text-base-content/70 mb-1">
          <span>{title}</span>
        </div>
        <div className="text-3xl font-bold text-base-content">{value}</div>
      </div>
      
      {/* Icon on the right */}
      {icon && (
        <div className="flex items-center justify-center p-3 bg-accent/10 rounded-xl transition-colors duration-300 group-hover:bg-accent/20">
          <span className="text-3xl text-accent">{icon}</span>
        </div>
      )}
    </div>
  );
}
