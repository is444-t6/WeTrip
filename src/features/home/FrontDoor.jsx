import { isLoggedIn } from '../auth/session'
import SignedOutCard from '../../components/SignedOutCard'
import Home from './Home'

// The front door at "/". Signed in, it is the home page; signed out, it is a
// plain WeTrip sign-in card on the same address, not a redirect into one product.
export default function FrontDoor() {
  return isLoggedIn() ? <Home /> : <SignedOutCard title="WeTrip" />
}
