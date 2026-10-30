import { createFileRoute } from '@tanstack/react-router'
import ChildDetail from '../features/family/ChildDetail'

export const Route = createFileRoute('/family/child/$familyLinkId')({
  component: ChildDetail,
})
