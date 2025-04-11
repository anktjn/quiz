import { cn } from "../utils/cn";

export default function StatCard({ title, value, icon, className }) {
  return (
    <div className={cn("bg-base-200 p-6 rounded-xl shadow-md", className)}>
      <div className="text-sm text-gray-500 mb-1 flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        <span>{title}</span>
      </div>
      <div className="text-3xl font-bold text-primary">{value}</div>
    </div>
  );
}
