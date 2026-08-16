import { useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { ConversationList, ChatRoom } from "../components/profile/CollectionChat";
import PushPrompt from "../components/PushPrompt";
import "./CollectionChatPage.css";

/**
 * A collection's discussion, on its own page [#6].
 *
 * It started life embedded in the collection drawer, which was wrong: a
 * conversation grows without bound, and the drawer is a fold inside a modal
 * inside the profile page — three fixed-height containers around something that
 * only gets taller. Long threads had nowhere to go.
 *
 * Here the page itself scrolls, so a room with four hundred messages behaves
 * like any other page of text.
 *
 * The collection's title arrives in router state from the drawer. On a deep link
 * or a refresh there is no state, and rather than fetch a whole profile to
 * recover one string, the page falls back to a plain heading — the book titles
 * below are what the reader actually navigates by.
 */
export default function CollectionChatPage() {
  const { collectionId, bookId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();

  const collection = { id: collectionId, title: state?.title };
  // Set when arriving via a book row; recovered from the list when deep-linked.
  const [book, setBook] = useState(
    bookId ? { book_id: bookId, title: state?.bookTitle || "this book" } : null,
  );

  const openBook = (row) => {
    setBook(row);
    navigate(`/collections/${collectionId}/discussion/${row.book_id}`, {
      replace: false,
      state: { title: collection.title, bookTitle: row.title },
    });
  };

  const back = () => {
    setBook(null);
    navigate(`/collections/${collectionId}/discussion`, {
      state: { title: collection.title },
    });
  };

  return (
    <div className="ccp">
      <div className="ccp-head">
        <Link to="/me" className="ccp-back">← your study</Link>
        <h1 className="ccp-title">{collection.title || "Discussion"}</h1>
      </div>

      {/* The one place the ask makes sense: standing in a conversation with
          other people in it. Asked once, then never again. */}
      <PushPrompt />

      {book
        ? <ChatRoom collection={collection} book={book} onBack={back} />
        : <ConversationList collection={collection} onOpen={openBook} />}
    </div>
  );
}
