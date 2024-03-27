// https://www.joshwcomeau.com/snippets/react-hooks/use-mouse-position/
import { useEffect, useState } from 'react';

const useMousePosition = () => {
    const [mousePosition, setMousePosition] = useState<{ x: number | undefined; y: number | undefined }>({ x: undefined, y: undefined });

    useEffect(() => {
        const updateMousePosition = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', updateMousePosition);

        return () => window.removeEventListener('mousemove', updateMousePosition);
    }, []);

    return mousePosition;
};

export default useMousePosition;