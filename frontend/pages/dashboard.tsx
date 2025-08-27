import { useRouter } from "next/router";
import {
  useEffect,
  useState,
  useMemo,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { bookSpot } from "../lib/api";
import { calculateFinalCost } from "../lib/cost";
import PaymentSection from "../components/PaymentSection";
import BookingSummary, { Booking } from "../components/BookingSummary";
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function fetcher(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Fetch error");
  return res.json();
}

export default function Dashboard() {
  const router = useRouter();
  const { mutate } = useSWRConfig();

  // --- Auth ---
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    const t = localStorage.getItem("token");
    setToken(t);
    setAuthLoading(false);
    if (!t) router.replace("/login");
  }, [router]);
  function logout() {
    localStorage.removeItem("token");
    router.replace("/login");
  }

  // --- Booking Form State ---
  const [plate, setPlate] = useState("");
  const [start, setStart] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [hours, setHours] = useState(1);
  const [days, setDays] = useState(0);
  const [months, setMonths] = useState(0);

 const cleanPlate = plate.trim().toUpperCase();

const { data: subs, error: subsError } = useSWR(
  token ? [`${API_URL}/subscribers`, token] : null,
  fetcher
);

// debug:
useEffect(() => {
  if (subsError) console.error("Failed to fetch subscribers:", subsError);
  if (subs) console.log("Subscribers from API:", subs);
}, [subs, subsError]);

// build a Set<string> of uppercase plates
const subsSet = useMemo(
  () => new Set<string>((subs as string[] | undefined)?.map(p => p.toUpperCase()) ?? []),
  [subs]
);

const isSubscriber = Boolean(cleanPlate && subsSet.has(cleanPlate));

  // --- Occupancy at Selected Start Time ---
  const isoStart = new Date(start).toISOString();
  const { data: occ } = useSWR(
    token
      ? [`${API_URL}/occupancy?at=${encodeURIComponent(isoStart)}`, token]
      : null,
    fetcher,
    { refreshInterval: 10000 }
  );
  const occupied = occ?.occupied ?? 0;
  const total = occ?.total ?? 1;
  const freeSlots = total - occupied;

  // --- Profile / Loyalty Points ---
  const { data: me } = useSWR(
    token ? [`${API_URL}/auth/me`, token] : null,
    fetcher
  );
  const loyaltyPoints = me?.loyaltyPoints ?? 0;

  // --- Cost Calculation ---
  const estimatedCost = useMemo(
    () =>
      calculateFinalCost(
        hours,
        days,
        months,
        new Date(start),
        occupied,
        total,
        isSubscriber,
        loyaltyPoints
      ),
    [
      hours,
      days,
      months,
      start,
      occupied,
      total,
      isSubscriber,
      loyaltyPoints,
    ]
  );

  // --- Booking + Payment State ---
  const [booking, setBooking] = useState<Booking | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);

  // --- Handlers ---
  async function handleBooking(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setBooking(null);
    setPaymentComplete(false);

    if (hours + days + months === 0) {
      setErrorMsg("Duration must be greater than zero.");
      return;
    }
    if (freeSlots <= 0) {
      setErrorMsg("No slots available.");
      return;
    }

    try {
      const res = await bookSpot(token!, {
        start: isoStart,
        hours,
        days,
        months,
        plate: cleanPlate,
      });
      setBooking({
        slot: res.slot,
        start: res.start,
        end: res.end,
        qr: res.qr,
        amount: estimatedCost,
      });
      // refresh occupancy
      mutate([
        `${API_URL}/occupancy?at=${encodeURIComponent(isoStart)}`,
        token,
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || "Booking failed.");
    }
  }

  if (authLoading || !token) return null;

  return (
    <div className="container">
      <header className="header">
        <h1> Park & Ride Dashboard</h1>
        <button className="btn logout" onClick={logout}>
          Logout
        </button>
      </header>

      {/* 1) New Booking Form */}
      {!booking && (
        <section className="card">
          <h2>New Booking</h2>
          <form onSubmit={handleBooking} className="booking-form">
            <label>
              Plate Number:
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="ABC-1234"
                required
              />
            </label>
            {cleanPlate && (
              <p>
                Subscriber?{" "}
                <strong>{isSubscriber ? "Yes ✅" : "No ❌"}</strong>
              </p>
            )}
            <label>
              Start Time:
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </label>
            <label>
              Duration:
              <input
                type="number"
                min={0}
                value={hours}
                onChange={(e) => setHours(+e.target.value)}
              />{" "}
              hrs
              <input
                type="number"
                min={0}
                value={days}
                onChange={(e) => setDays(+e.target.value)}
              />{" "}
              days
              <input
                type="number"
                min={0}
                value={months}
                onChange={(e) => setMonths(+e.target.value)}
              />{" "}
              months
            </label>
            <p>
              Occupancy @ {new Date(isoStart).toLocaleString()}:{" "}
              {occupied}/{total} (free: {freeSlots})
            </p>
            <p>Loyalty Points: {loyaltyPoints}</p>
            <div className="action-row">
              <span className="estimated-cost">
                Cost: <strong>${estimatedCost.toFixed(2)}</strong>
              </span>
              <button type="submit" className="btn primary">
                Book Slot
              </button>
            </div>
          </form>
          {errorMsg && (
            <div className="message error">
              <p>{errorMsg}</p>
            </div>
          )}
        </section>
      )}

      {/* 2) Payment Form */}
      {booking && !paymentComplete && (
        <section className="card">
          <h2> Complete Payment</h2>
          <PaymentSection
            bookingId={booking.qr}
            amount={booking.amount}
            onSuccess={() => setPaymentComplete(true)}
          />
        </section>
      )}

      {/* 3) Final Booking Summary */}
      {booking && paymentComplete && (
         <div>
        <BookingSummary booking={booking} />
         {/* ← Add this “Back” button below the summary */}
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <button
          className="btn info"
          onClick={() => {
            // reset everything so they see the form again
            setBooking(null);
            setPaymentComplete(false);
            setErrorMsg(null);
            // (optionally) reset your form fields too:
            setPlate("");
            setStart(new Date().toISOString().slice(0, 16));
            setHours(1);
            setDays(0);
            setMonths(0);
          }}
        >
          ← Back to Dashboard
        </button>
        </div>
       </div>
      )}
   
      {/* 4) Extra Links */}
      <section className="card link-card">
        <h2>Need to Cancel?</h2>
        <button
          className="btn danger"
          onClick={() => router.push("/cancel")}
        >
          Go to Cancellation
        </button>
      </section>
      <section className="card link-card">
        <h2>Check Availability</h2>
        <button
          className="btn info"
          onClick={() => router.push("/availability")}
        >
          View Available Slots
        </button>
      </section>
      <section className="card link-card">
      <h2>Become a Subscriber</h2>
      <button className="btn info" onClick={() => router.push("/subscribe")}>
       Subscribe Now
      </button>
      </section>


      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 2rem auto;
          padding: 0 1rem;
          font-family: sans-serif;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .card {
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        .link-card {
          text-align: center;
        }
        label {
          display: block;
          margin-bottom: 0.75rem;
          font-weight: 500;
        }
        input[type="text"],
        input[type="datetime-local"],
        input[type="number"] {
          margin-left: 0.5rem;
          padding: 0.4rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .btn {
          padding: 0.6rem 1.2rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          margin-top: 1rem;
        }
        .primary {
          background: #0070f3;
          color: #fff;
        }
        .danger {
          background: #f44336;
          color: #fff;
        }
        .info {
          background: #2196f3;
          color: #fff;
        }
        .logout {
          background: #e00;
          color: #fff;
        }
        .booking-form .action-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 1rem;
        }
        .estimated-cost {
          font-size: 1.1rem;
          color: #0070f3;
        }
        .message.error {
          background: #ffebee;
          border: 1px solid #f44336;
          color: #b71c1c;
          padding: 1rem;
          border-radius: 6px;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
}