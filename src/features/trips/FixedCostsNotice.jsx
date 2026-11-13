import { useLocation } from '@tanstack/react-router'
import Banner from '../../components/Banner'

// Set by the new-trip form when PlanTrip created the trip but not every fixed cost.
export default function FixedCostsNotice() {
  const failed = useLocation({ select: (l) => Number(l.state?.fixedCostsFailed) || 0 })
  return (
    <Banner>
      {failed > 0 &&
        (failed === 1
          ? "1 fixed cost wasn't saved. Add it on the budget page."
          : `${failed} fixed costs weren't saved. Add them on the budget page.`)}
    </Banner>
  )
}
