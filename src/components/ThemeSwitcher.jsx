import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';

const themes = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset"
];

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") ?? "corporateecho"
  );

  // Update theme when component mounts and whenever theme changes
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
        <Palette size={20} />
      </div>
      <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-lg bg-base-200 rounded-box w-56 max-h-[70vh] overflow-y-auto grid grid-cols-1 gap-1">
        {themes.map((t) => (
          <li key={t}>
            <button
              className={`${theme === t ? "active" : ""}`}
              onClick={() => setTheme(t)}
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ 
                  backgroundColor: 'hsl(var(--p))',
                  border: '2px solid hsl(var(--p))'
                }} />
                <span className="capitalize">{t}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
