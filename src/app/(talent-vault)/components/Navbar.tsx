"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MenuIcon } from "./icons/MenuIcon";
import { XIcon } from "./icons/XIcon";

type NavbarContextType = {
  isMenuOpen: boolean;
  isClosing: boolean;
  toggleMenu: () => void;
  items: Array<{ href: string; label: string }>;
  setItems: (items: Array<{ href: string; label: string }>) => void;
};

const NavbarContext = createContext<NavbarContextType | null>(null);

export function Navbar({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [items, setItems] = useState<Array<{ href: string; label: string }>>([]);

  const toggleMenu = useCallback(() => {
    if (isMenuOpen) {
      setIsClosing(true);
      setTimeout(() => {
        setIsMenuOpen(false);
        setIsClosing(false);
      }, 300);
    } else {
      setIsMenuOpen(true);
    }
  }, [isMenuOpen]);

  const contextValue = useMemo(
    () => ({ isMenuOpen, isClosing, toggleMenu, items, setItems }),
    [isMenuOpen, isClosing, toggleMenu, items, setItems]
  );

  return (
    <NavbarContext.Provider value={contextValue}>
      <nav className="tv-nav">{children}</nav>
    </NavbarContext.Provider>
  );
}

Navbar.Menu = ({ children }: { children: React.ReactNode }) => {
  return <div className="tv-nav--left">{children}</div>;
}

Navbar.Brand = ({ link, src, alt }: { link?: string; src: string; alt: string }) => {
  return <a href={link ?? "/"}><img className="tv-nav--brand" src={src} alt={alt} /></a>;
}

Navbar.Items = ({ children }: { children: React.ReactNode }) => {
  const context = useContext(NavbarContext);
  const setItems = context?.setItems;
  const prevItemsRef = useRef<string>('');
  
  const items = useMemo(() => {
    const result: Array<{ href: string; label: string }> = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        const props = child.props as any;
        if (props?.href && props?.label) {
          result.push({ href: props.href, label: props.label });
        }
      }
    });
    return result;
  }, [children]);

  useEffect(() => {
    if (!setItems || !items.length) return;
    
    const itemsKey = JSON.stringify(items);
    if (prevItemsRef.current !== itemsKey) {
      prevItemsRef.current = itemsKey;
      setItems(items);
    }
  }, [items, setItems]);

  return <ul className="tv-nav--items">{children}</ul>;
}

Navbar.Item = ({ href, label }: { href: string; label: string }) => {
  return <li><a href={href}>{label}</a></li>;
}

Navbar.MenuIcon = ({ src, alt }: { src: string; alt: string }) => {
  return <img src={src} alt={alt} />;
}

Navbar.Actions = ({ children }: { children: React.ReactNode }) => {
  const context = useContext(NavbarContext);
  
  if (!context) {
    return null;
  }

  const { isMenuOpen, isClosing, toggleMenu, items } = context;

  return (
    <>
      <div className="tv-nav--right-wrapper">
        <div className="tv-nav--right">
          {children}
        </div>

        <button 
          className="tv-nav--menu-icon" 
          onClick={toggleMenu}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? <XIcon size={25} /> : <MenuIcon size={25} />}
        </button>
      </div>

      {(isMenuOpen || isClosing) && (
        <div className={`tv-nav--mobile-menu ${isClosing ? 'closing' : ''}`}>
          <div className="tv-nav--mobile-menu-content">
            <ul className="tv-nav--mobile-items">
              {items.map((item) => (
                <li key={item.href}>
                  <a href={item.href} onClick={toggleMenu}>{item.label}</a>
                </li>
              ))}
            </ul>
            
            <hr className="tv-nav--mobile-separator" />
            
            <div className="tv-nav--mobile-actions">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}