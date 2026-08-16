import { useParams, useLocation, Link } from "react-router-dom";
import CollectionChat from "../components/profile/CollectionChat";
import PushPrompt from "../components/PushPrompt";
import "./CollectionChatPage.css";

/**
 * A collection's discussion, on its own page [#6].
 *
 * One room, straight in. There used to be a book-list step in front of this,
 * back when every book had its own room — which meant two taps to reach a
 * conversation and a wall of "start it" rows for books nobody had discussed.
 * The book is now a filter inside the room.
 *
 * The page itself scrolls, so a long thread behaves like a page of text rather
 * than a box inside a drawer inside a modal, which is where this started.
 */
export default function CollectionChatPage() {
  const { collectionId } = useParams();
  const { state } = useLocation();

  return (
    <div className="ccp">
      <div className="ccp-head">
        <Link to="/me" className="ccp-back">← your study</Link>
        {/* The title rides in on router state. A deep link or a refresh has
            none, and fetching a whole profile to recover one string is not
            worth it — the conversation names itself. */}
        <h1 className="ccp-title">{state?.title || "Discussion"}</h1>
      </div>

      <PushPrompt />
      <CollectionChat collectionId={collectionId} />
    </div>
  );
}
