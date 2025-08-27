import useSWR, { KeyedMutator } from "swr";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not defined");

// ---------------- Types ----------------

export type BookingIn = {
  start: string; // ISO format
  hours: number;
  days: number;
  months: number;
  plate: string;
};

export type BookingOut = {
  slot: { row: number; col: number };
  start: string;
  end: string;
  qr: string;
};

export type CancelIn = {
  row: number;
  col: number;
  start: string;
  end: string;
  plate: string;
};

// ---------------- Shared Fetcher ----------------

async function fetcher<T = any>([url, token]: [string, string]): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg);
  }

  return res.json();
}

// ---------------- useOccupancy Hook ----------------

export function useOccupancy(at: string, token: string | null) {
  const key = token
    ? [`${API_URL}/occupancy?at=${encodeURIComponent(at)}`, token]
    : null;
  const { data, error, mutate } = useSWR<{ occupied: number; total: number }>(
    key,
    fetcher
  );

  return {
    occupancy: data,
    isLoading: !error && !data,
    isError: error as Error | undefined,
    mutate: mutate as KeyedMutator<{ occupied: number; total: number }>,
  };
}

// ---------------- Book a Spot ----------------

export async function bookSpot(
  token: string,
  booking: BookingIn
): Promise<BookingOut> {
  const res = await fetch(`${API_URL}/book`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(booking),
  });

  const isJson = res.headers.get("Content-Type")?.includes("application/json");

  if (!res.ok) {
    const error = isJson ? await res.json() : { detail: await res.text() };
    throw new Error(error.detail || "Booking failed");
  }

  return await res.json();
}

// ---------------- Cancel a Spot ----------------

export async function cancelSpot(
  token: string,
  payload: CancelIn
): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/cancel`, {
    method: "POST", // Backend expects POST
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const isJson = res.headers.get("Content-Type")?.includes("application/json");

  if (!res.ok) {
    const error = isJson ? await res.json() : { detail: await res.text() };
    throw new Error(error.detail || "Cancellation failed");
  }

  return await res.json();
}
