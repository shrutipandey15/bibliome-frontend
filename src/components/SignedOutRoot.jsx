import { Navigate, useLocation } from "react-router-dom";
import LandingPage from "../pages/LandingPage";
import { stashReturn } from "../services/pendingInvite";

// Query params that mean "a visitor arrived from a campaign", not "a page in the
// app". Everything else on `/` (?view=, ?entry=, ?add=, ?letter=) is a deep link.
const MARKETING_PARAMS = /^(utm_|ref$|fbclid$|gclid$)/;

/**
 * Signed out, `/` is the landing page, and nothing else under it is: every other
 * path there is a page that needs an account. Park it and sign in, rather than
 * showing the landing page in its place and losing where they were going.
 * A bare `#section` on `/` is the landing page's own navigation, not a deep link.
 */
export default function SignedOutRoot({ onGetStarted }) {
  const { pathname, search, hash } = useLocation();
  const params = [...new URLSearchParams(search).keys()];
  const deep = pathname !== "/" || params.some((k) => !MARKETING_PARAMS.test(k));
  if (deep) {
    stashReturn(pathname + search + hash);
    return <Navigate to="/login" replace />;
  }
  return <LandingPage onGetStarted={onGetStarted} />;
}
