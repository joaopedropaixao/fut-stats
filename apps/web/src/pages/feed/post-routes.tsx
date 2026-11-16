import { Navigate, useParams } from 'react-router';
import { EditPostPage, NewPostPage } from './post-form-page';
import { postScreen } from './post-screen';

/**
 * As telas das resenhas (`/resenhas/*`), resolvidas dentro do pedaço do Feed: no router entra uma rota só, e o
 * JS inicial não paga um `lazy` por tela (nem o `Routes` do router, que engordaria o pedaço compartilhado).
 */
export function PostRoutes() {
  const screen = postScreen(useParams()['*']);
  if (screen?.screen === 'new') return <NewPostPage />;
  if (screen?.screen === 'edit') return <EditPostPage postId={screen.postId} />;
  return <Navigate to="/" replace />;
}
