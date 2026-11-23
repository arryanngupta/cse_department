import { useLocation } from 'react-router-dom';
import AssistantWidget from './AssistantWidget.jsx';

/**
 * Mounts the assistant on public pages only.
 *
 * Rendered once at the router level rather than per-route, so the panel and
 * its conversation survive navigation between pages. Hidden under /admin,
 * where it would overlap the management UI and serves no purpose.
 */
export default function PublicAssistant() {
  const { pathname } = useLocation();

  if (pathname.startsWith('/admin')) return null;

  return <AssistantWidget />;
}
