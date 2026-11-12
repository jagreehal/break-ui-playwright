// ask-sonner: the troubleshooting table, reproduced (before) and fixed (?fixed). Bundled by `pnpm build`.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Toaster, toast } from 'sonner';

const fixed = new URLSearchParams(location.search).has('fixed');
// Before: the promise never settles, so the loading toast waits forever.
const upload = () => (fixed ? new Promise((done) => setTimeout(done, 500)) : new Promise(() => {}));

function Page() {
  const [dialog, setDialog] = useState(false);
  return (
    <main>
      {!fixed && <Toaster />/* Before: a second Toaster on the page, so every toast shows twice */}
      <h1>Settings</h1>
      <button onClick={() => toast.success('Settings saved')}>Save</button>
      <button onClick={() => toast.promise(upload(), { loading: 'Uploading…', success: 'Uploaded', error: 'Upload failed' })}>Upload</button>
      <button onClick={() => setDialog(true)}>Share</button>
      {dialog && createPortal(
        <div className="overlay">
          <div role="dialog" aria-label="Share">
            <p>Anyone with the link can view.</p>
            <button onClick={() => toast('Link copied')}>Copy link</button> <button onClick={() => setDialog(false)}>Done</button>
          </div>
        </div>,
        document.body, // dialogs portal to the body, as most dialog libraries do
      )}
    </main>
  );
}

const App = () =>
  fixed ? (
    <>
      <Page />
      <Toaster theme="system" richColors />
    </>
  ) : (
    // Before: the layout's Toaster sits in a transformed, low z-index wrapper: a new stacking context under the dialog overlay.
    <div style={{ transform: 'translateZ(0)', position: 'relative', zIndex: 1, minHeight: '100vh' }}>
      <Toaster />
      <Page />
    </div>
  );

createRoot(document.getElementById('root')).render(<App />);
