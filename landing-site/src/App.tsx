import Navbar from "./components/Navbar";
import Hero from "./components/Hero";

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />

        {/* Temporary anchor targets — real sections will replace these next. */}
        <section id="story" className="h-screen bg-ivory flex items-center justify-center">
          <p className="text-maroon font-serif text-2xl">Our Story (coming next)</p>
        </section>
        <section id="offer" className="h-screen bg-white flex items-center justify-center">
          <p className="text-maroon font-serif text-2xl">What We Offer (coming next)</p>
        </section>
        <section id="process" className="h-screen bg-ivory flex items-center justify-center">
          <p className="text-maroon font-serif text-2xl">How We Work (coming next)</p>
        </section>
        <section id="why" className="h-screen bg-white flex items-center justify-center">
          <p className="text-maroon font-serif text-2xl">Why Choose Us (coming next)</p>
        </section>
        <section id="gallery" className="h-screen bg-ivory flex items-center justify-center">
          <p className="text-maroon font-serif text-2xl">Gallery (coming next)</p>
        </section>
        <section id="contact" className="h-screen bg-white flex items-center justify-center">
          <p className="text-maroon font-serif text-2xl">Contact (coming next)</p>
        </section>
      </main>
    </>
  );
}
