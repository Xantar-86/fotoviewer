'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  ImageIcon,
  Sparkles,
  BarChart3,
  Settings,
  Zap,
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { href: '/',         icon: LayoutDashboard, label: 'Dashboard',    description: 'Overzicht' },
  { href: '/editor',   icon: ImageIcon,       label: 'Foto Editor',  description: 'Bewerken & verwerken' },
  { href: '/ai',       icon: Sparkles,        label: 'AI Studio',    description: 'Claude AI assistent' },
  { href: '/business', icon: BarChart3,       label: 'Business',     description: 'Inkomsten & bestellingen' },
  { href: '/settings', icon: Settings,        label: 'Instellingen', description: 'API sleutels & voorkeur' },
]

// ─── Desktop sidebar (hidden on mobile) ──────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 z-40 flex-col">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xl border-r border-white/[0.06]" />

        <div className="relative flex flex-col h-full p-4">
          {/* Logo */}
          <div className="mb-8 pt-2 px-2">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-glow-sm flex-shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">FeetBusiness</h1>
                <p className="text-[10px] font-medium text-purple-400 uppercase tracking-widest">Studio v2</p>
              </div>
            </motion.div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 flex flex-col gap-1">
            {navItems.map((item, index) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={item.href}
                    className={clsx(
                      'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden',
                      isActive
                        ? 'text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-gradient-to-r from-purple-600/30 to-violet-600/20 border border-purple-500/25 rounded-xl"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                    <div className={clsx(
                      'relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 flex-shrink-0',
                      isActive
                        ? 'bg-purple-500/30 text-purple-300'
                        : 'text-white/40 group-hover:text-white/60 group-hover:bg-white/[0.06]'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="relative flex-1 min-w-0">
                      <div className={clsx('text-sm font-semibold leading-tight', isActive ? 'text-white' : '')}>
                        {item.label}
                      </div>
                      <div className="text-[10px] text-white/30 mt-0.5">{item.description}</div>
                    </div>
                    {isActive && <ChevronRight className="relative w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                  </Link>
                </motion.div>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="mt-4 px-2">
            <div className="glass rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium text-white/60">Verbonden</span>
              </div>
              <p className="text-[10px] text-white/30 leading-relaxed">FeetBusiness Studio actief</p>
            </div>
            <p className="text-center text-[10px] text-white/20 mt-3">FeetBusiness Studio © 2025</p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <MobileNav pathname={pathname} />
    </>
  )
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl border-t border-white/[0.08]" />
      <div className="relative flex items-center justify-around px-2 py-2 safe-area-pb">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-0 flex-1"
            >
              <div className={clsx(
                'relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 overflow-hidden',
                isActive ? 'text-purple-300' : 'text-white/40'
              )}>
                {isActive && (
                  <motion.div
                    layoutId="activeMobileNav"
                    className="absolute inset-0 bg-gradient-to-br from-purple-600/40 to-violet-600/30 rounded-xl"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon className="w-5 h-5 relative z-10" />
              </div>
              <span className={clsx(
                'text-[10px] font-medium leading-tight truncate w-full text-center',
                isActive ? 'text-purple-300' : 'text-white/30'
              )}>
                {item.label.split(' ')[0]}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
