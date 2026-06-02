import { useState, useEffect } from "react";

export const useMobileMenu = () => {
    const [isStickyMobileMenu, setIsStickyMobileMenu] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);
  
    useEffect(() => {
      // Handler to call on window scroll
      function listenToScroll() {
        const currentScrollY = window.scrollY;
        
        // If at the top of the page, show the navbar
        if (currentScrollY <= 100) {
          setIsStickyMobileMenu(window.innerWidth < 1000);
        }
        // If scrolling up and past the navbar threshold, show the sticky navbar
        else if (currentScrollY < lastScrollY && currentScrollY > 100) {
          setIsStickyMobileMenu(true);
        } 
        // If scrolling down past threshold, hide the navbar
        else if (currentScrollY > lastScrollY && currentScrollY > 100) {
          setIsStickyMobileMenu(false);
        }
        
        setLastScrollY(currentScrollY);
      }
      // Add event listener
      window.addEventListener('scroll', listenToScroll, { passive: true })
      // Call handler right away so state gets updated with initial window size
      listenToScroll()
      // Remove event listener on cleanup
      return () => window.removeEventListener('scroll', listenToScroll)
    }, [lastScrollY])

    return { isStickyMobileMenu };
}