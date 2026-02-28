export interface MissionQuote {
  text: string;
  attribution: string;
}

export const QUOTES: Record<string, MissionQuote[]> = {
  ngo: [
    { text: "Lack of water quality data is a form of environmental injustice.", attribution: "Eos, American Geophysical Union" },
    { text: "Water is the most critical resource issue of our lifetime.", attribution: "National Geographic" },
    { text: "When the well is dry, we know the worth of water.", attribution: "Benjamin Franklin" },
    { text: "Thousands have lived without love, not one without water.", attribution: "W.H. Auden" },
    { text: "We forget that the water cycle and the life cycle are one.", attribution: "Jacques Cousteau" },
    { text: "Clean water is not an expenditure — it is an investment.", attribution: "UN Water" },
    { text: "A river is more than an amenity, it is a treasure.", attribution: "Justice Oliver Wendell Holmes" },
    { text: "The health of our waters is the principal measure of how we live on the land.", attribution: "Luna Leopold" },
    { text: "Access to safe water is a fundamental human need and a basic human right.", attribution: "Kofi Annan" },
    { text: "In every glass of water we drink, some of the water has already passed through fishes, trees, bacteria, and many other organisms.", attribution: "Loren Eiseley" },
  ],
  esg: [
    { text: "Water risk is financial risk.", attribution: "CDP Water Security" },
    { text: "Lack of water quality data is a form of environmental injustice.", attribution: "Eos, American Geophysical Union" },
    { text: "Sustainability is no longer about doing less harm. It's about doing more good.", attribution: "Jochen Zeitz" },
    { text: "What gets measured gets managed.", attribution: "Peter Drucker" },
    { text: "The economy is a wholly owned subsidiary of the environment.", attribution: "Herman Daly" },
    { text: "Water is the driving force of all nature.", attribution: "Leonardo da Vinci" },
    { text: "Corporate water stewardship is not philanthropy — it is risk management.", attribution: "CEO Water Mandate" },
    { text: "The cost of inaction on water far exceeds the cost of action.", attribution: "OECD" },
    { text: "Environmental compliance is the floor, not the ceiling.", attribution: "EPA" },
    { text: "Nature is not a place to visit. It is home.", attribution: "Gary Snyder" },
  ],
  biotech: [
    { text: "Water purity is the foundation of pharmaceutical quality.", attribution: "FDA cGMP Guidance" },
    { text: "The dose makes the poison.", attribution: "Paracelsus" },
    { text: "What gets measured gets managed.", attribution: "Peter Drucker" },
    { text: "Environmental compliance is the floor, not the ceiling.", attribution: "EPA" },
    { text: "Good manufacturing practice is not an option — it is a requirement.", attribution: "ICH Q7" },
    { text: "Water is the most used raw material in the pharmaceutical industry.", attribution: "USP" },
    { text: "The cost of prevention is always less than the cost of a recall.", attribution: "FDA" },
    { text: "Pharmaceuticals in waterways are the next frontier of environmental regulation.", attribution: "OECD" },
    { text: "Every molecule we release becomes part of someone's drinking water.", attribution: "ACS Green Chemistry" },
    { text: "Quality must be built into a drug product, not tested into it.", attribution: "FDA Process Validation Guidance" },
  ],
  investor: [
    { text: "Water risk is financial risk.", attribution: "CDP Water Security" },
    { text: "The cost of inaction on water far exceeds the cost of action.", attribution: "OECD" },
    { text: "Climate risk is investment risk.", attribution: "Larry Fink, BlackRock" },
    { text: "What gets measured gets managed.", attribution: "Peter Drucker" },
    { text: "Water scarcity is the defining crisis of the 21st century.", attribution: "World Economic Forum" },
    { text: "Stranded assets are not hypothetical — they are already materializing.", attribution: "Carbon Tracker Initiative" },
    { text: "ESG integration is not about values — it is about value.", attribution: "CFA Institute" },
    { text: "The economy is a wholly owned subsidiary of the environment.", attribution: "Herman Daly" },
    { text: "Investors who ignore water risk do so at their own peril.", attribution: "CEO Water Mandate" },
    { text: "Corporate water stewardship is not philanthropy — it is risk management.", attribution: "CEO Water Mandate" },
  ],
  public: [
    { text: "Lack of water quality data is a form of environmental injustice.", attribution: "Eos, American Geophysical Union" },
    { text: "We forget that the water cycle and the life cycle are one.", attribution: "Jacques Cousteau" },
    { text: "Water is the driving force of all nature.", attribution: "Leonardo da Vinci" },
    { text: "The health of our waters is the principal measure of how we live on the land.", attribution: "Luna Leopold" },
    { text: "Thousands have lived without love, not one without water.", attribution: "W.H. Auden" },
    { text: "Clean water is not an expenditure — it is an investment.", attribution: "UN Water" },
    { text: "When the well is dry, we know the worth of water.", attribution: "Benjamin Franklin" },
    { text: "Access to safe water is a fundamental human need and a basic human right.", attribution: "Kofi Annan" },
  ],
};

const SESSION_KEY_PREFIX = "pearl_quote_idx_";

export function getSessionQuote(role: string): MissionQuote {
  const quotes = QUOTES[role] ?? QUOTES.public;

  if (typeof window === "undefined") {
    return quotes[0];
  }

  const key = SESSION_KEY_PREFIX + role;
  const stored = sessionStorage.getItem(key);

  if (stored !== null) {
    const idx = parseInt(stored, 10);
    if (idx >= 0 && idx < quotes.length) {
      return quotes[idx];
    }
  }

  const idx = Math.floor(Math.random() * quotes.length);
  sessionStorage.setItem(key, String(idx));
  return quotes[idx];
}
