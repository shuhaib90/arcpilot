'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  MessageSquare, 
  Wallet as WalletIcon, 
  History, 
  BarChart2, 
  Settings as SettingsIcon,
  LogOut,
  Terminal,
  Home,
  Users,
  Contact,
  Calendar
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, wallet, logout } = useApp();

  // If user is not logged in, we do not show full sidebar (or we show minimal layout)
  if (!user) {
    return (
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link href="/">
            <div className="sidebar-logo">
              <img 
                src="/logo.png" 
                alt="ARCPILOT" 
                style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
              />
              <span>ARCPILOT</span>
            </div>
          </Link>
        </div>
        <ul className="sidebar-menu">
          <li className={`sidebar-item ${pathname === '/' ? 'active' : ''}`}>
            <Link href="/">
              <Home size={16} />
              <span>Home</span>
            </Link>
          </li>
          <li className={`sidebar-item ${pathname === '/login' ? 'active' : ''}`}>
            <Link href="/login">
              <Terminal size={16} />
              <span>Connect Console</span>
            </Link>
          </li>
        </ul>
        <div className="sidebar-footer">
          <div className="sidebar-user" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            System ready.
          </div>
        </div>
      </aside>
    );
  }

  const menuItems = [
    { name: 'Console Chat', path: '/chat', icon: <MessageSquare size={16} /> },
    { name: 'My Wallet', path: '/wallet', icon: <WalletIcon size={16} /> },
    { name: 'Team Treasury', path: '/teams', icon: <Users size={16} /> },
    { name: 'Recurring Schedules', path: '/schedules', icon: <Calendar size={16} /> },
    { name: 'Contacts Book', path: '/contacts', icon: <Contact size={16} /> },
    { name: 'Transactions', path: '/transactions', icon: <History size={16} /> },
    { name: 'Insights & Analytics', path: '/analytics', icon: <BarChart2 size={16} /> },
    { name: 'Safety Settings', path: '/settings', icon: <SettingsIcon size={16} /> },
  ];

  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar-header">
          <Link href="/chat">
            <div className="sidebar-logo">
              <img 
                src="/logo.png" 
                alt="ARCPILOT" 
                style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
              />
              <span>ARCPILOT</span>
            </div>
          </Link>
        </div>
        <ul className="sidebar-menu">
          {menuItems.map(item => (
            <li key={item.path} className={`sidebar-item ${pathname === item.path ? 'active' : ''}`}>
              <Link href={item.path}>
                {item.icon}
                <span>{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-username">@{user.username}</div>
            <div className="sidebar-user-wallet" title={user.wallet_address}>
              {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Balance:</span>
          <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{wallet?.balance.toFixed(2)} ARC</span>
        </div>

        <button onClick={logout} className="btn" style={{ width: '100%', padding: '6px', fontSize: '12px', justifyContent: 'center' }}>
          <LogOut size={14} />
          <span>Disconnect</span>
        </button>
      </div>
    </aside>
  );
}
