import { useState, useEffect } from "react";
import type { CareerItem } from "./types";

const careers: CareerItem[] = [];

export function useCareers() {
  const [data, setData] = useState<CareerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCareers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 800));
        
        // In production, replace with actual API call:
        // const response = await fetch('/api/careers');
        // const data = await response.json();
        
        setData(careers);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch careers"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCareers();
  }, []);

  return { data, isLoading, error };
}

export function useCareerById(id: string) {
  const [data, setData] = useState<CareerItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCareer = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        // In production, replace with actual API call:
        // const response = await fetch(`/api/careers/${id}`);
        // const data = await response.json();
        
        const career = careers.find((c) => c.id === id);
        if (!career) {
          throw new Error("Career not found");
        }
        
        setData(career);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch career"));
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchCareer();
    }
  }, [id]);

  return { data, isLoading, error };
}
