# Task 08 — Media Support: Upload, Preview & Download

**Priority:** MEDIUM — FRD requirement for JPG/PNG/PDF/MP4 support
**Depends on:** 04_react_frontend (React components), 05_messaging (send flow extended with mediaUrl)
**Blocks:** Nothing

---

## Gap Summary

| FRD Requirement | Current State | Status |
|----------------|---------------|--------|
| Outbound media: JPG, PNG, PDF, MP4 file upload | No file upload support | ❌ Missing |
| Upload progress bar via XMLHttpRequest | No upload UI | ❌ Missing |
| Inline preview: `<img>` for images, `<video>` for MP4 | Text-only messages | ❌ Missing |
| PDF preview / download link (MinIO URL) | No media rendering | ❌ Missing |
| Inbound media: render received image/video/doc | No media rendering | ❌ Missing |
| `mediaUrl` in send payload | Field exists in schema, unused | ❌ Unused |
| File size/type validation | No validation | ❌ Missing |

---

## Tasks

### T8.1 — Backend: Media Upload Endpoint

**File:** `src/routes/widget.routes.js`

```javascript
router.post('/upload', widgetController.uploadMedia);
```

**Install multer:**
```bash
npm install multer
```

**File:** `src/controllers/widget.controller.js`

```javascript
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB max (WhatsApp limit)
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// In route registration:
router.post('/upload', upload.single('file'), widgetController.uploadMedia);

// Controller method:
async uploadMedia(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No file provided or unsupported type', code: 'INVALID_FILE' } });
    }
    const tenantId = req.headers['x-tenant-id'];
    const result = await widgetService.uploadMedia(req.file, tenantId);
    res.json({ mediaUrl: result.url, mediaType: result.type });
  } catch (err) {
    next(err);
  }
}
```

**File:** `src/services/widget.service.js`

```javascript
async uploadMedia(file, tenantId) {
  // Forward multipart file to whatsapp-api-service for MinIO upload
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const response = await axios.post(
    `${config.services.whatsappApiUrl}/whatsapp/media/upload`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'X-Tenant-ID': tenantId,
      },
      timeout: 30000,
    }
  );

  return { url: response.data.mediaUrl, type: file.mimetype };
}
```

---

### T8.2 — Frontend: FileUpload Button

**New file:** `src/client/components/FileUpload.jsx`

```jsx
import React, { useRef, useState } from 'react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'];
const MAX_SIZE_MB = 16;

export default function FileUpload({ tenantId, onUploadComplete, onUploadError }) {
  const [progress, setProgress] = useState(null);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      onUploadError('Unsupported file type. Allowed: JPG, PNG, PDF, MP4');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      onUploadError(`File too large. Maximum size: ${MAX_SIZE_MB}MB`);
      return;
    }

    uploadFile(file);
    e.target.value = ''; // reset input
  };

  const uploadFile = (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const token = getToken();
    const xhr = new XMLHttpRequest();

    // Use XMLHttpRequest for progress tracking (per FRD requirement)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        const result = JSON.parse(xhr.responseText);
        onUploadComplete({ mediaUrl: result.mediaUrl, mediaType: file.type, fileName: file.name });
      } else {
        onUploadError('Upload failed');
      }
    });

    xhr.addEventListener('error', () => {
      setProgress(null);
      onUploadError('Upload failed — network error');
    });

    xhr.open('POST', `${getBaseUrl()}/api/v1/widget/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('X-Tenant-ID', tenantId);
    xhr.send(formData);
  };

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,.mp4"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Attach file"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={progress !== null}
        aria-label="Attach media file"
        title="Attach file (JPG, PNG, PDF, MP4)"
      >
        📎
      </button>
      {progress !== null && (
        <div className="upload-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="upload-progress__bar" style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
}

function getToken() {
  return new URLSearchParams(window.location.search).get('token') || '';
}
function getBaseUrl() {
  return window.__WIDGET_CONFIG__?.apiUrl || window.location.origin;
}
```

---

### T8.3 — Frontend: MediaPreview Component

**New file:** `src/client/components/MediaPreview.jsx`

```jsx
import React, { useState } from 'react';

export default function MediaPreview({ url, type, fileName }) {
  const [expanded, setExpanded] = useState(false);

  if (!url) return null;

  if (type?.startsWith('image/')) {
    return (
      <div className="media-preview media-preview--image">
        <img
          src={url}
          alt={fileName || 'Attached image'}
          className={`media-img ${expanded ? 'expanded' : ''}`}
          onClick={() => setExpanded(e => !e)}
          style={{ maxWidth: expanded ? '100%' : '200px', cursor: 'pointer', borderRadius: '8px' }}
          loading="lazy"
        />
      </div>
    );
  }

  if (type === 'video/mp4') {
    return (
      <div className="media-preview media-preview--video">
        <video
          controls
          style={{ maxWidth: '280px', borderRadius: '8px' }}
          aria-label={fileName || 'Attached video'}
        >
          <source src={url} type="video/mp4" />
          Your browser does not support video playback.
        </video>
      </div>
    );
  }

  if (type === 'application/pdf') {
    return (
      <div className="media-preview media-preview--doc">
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Download PDF: ${fileName}`}>
          📄 {fileName || 'Document.pdf'}
        </a>
      </div>
    );
  }

  // Generic file download
  return (
    <div className="media-preview media-preview--file">
      <a href={url} target="_blank" rel="noopener noreferrer">
        📎 {fileName || 'Attachment'}
      </a>
    </div>
  );
}
```

---

### T8.4 — Integrate FileUpload into InputBox

**File:** `src/client/components/InputBox.jsx` (from T4.7)

```jsx
import FileUpload from './FileUpload';

// In InputBox component:
const [pendingMedia, setPendingMedia] = useState(null);

const handleSend = async () => {
  if ((!text.trim() && !pendingMedia) || sending) return;
  setSending(true);

  const optimistic = {
    id: `msg_${Date.now()}`,
    direction: 'outbound',
    text: text || null,
    mediaUrl: pendingMedia?.mediaUrl || null,
    mediaType: pendingMedia?.mediaType || null,
    status: 'pending',
    timestamp: new Date(),
  };
  onMessageSent(optimistic);
  setText('');
  setPendingMedia(null);

  try {
    await sendWithRetry({
      conversationId,
      tenantId,
      text: text || undefined,
      mediaUrl: pendingMedia?.mediaUrl || undefined,
      integrationId: window.__INTEGRATION_ID__,
    });
  } catch (err) {
    markFailed(optimistic.id);
  } finally {
    setSending(false);
  }
};

// In render:
<div className="input-row">
  <FileUpload
    tenantId={tenantId}
    onUploadComplete={setPendingMedia}
    onUploadError={err => alert(err)}
  />
  {pendingMedia && (
    <div className="pending-media">
      <MediaPreview url={pendingMedia.mediaUrl} type={pendingMedia.mediaType} />
      <button onClick={() => setPendingMedia(null)} aria-label="Remove attachment">✕</button>
    </div>
  )}
  <textarea ... />
  <button onClick={handleSend}>Send</button>
</div>
```

---

### T8.5 — File Type/Size Validation Summary

| Type | MIME | Max Size |
|------|------|----------|
| Image | image/jpeg, image/png | 5 MB |
| Document | application/pdf | 100 MB |
| Video | video/mp4 | 16 MB |

Validate on **both** frontend (for UX) and backend (for security).

Backend multer config should apply per-type limits using a custom file filter.

---

## Acceptance Criteria

- [ ] `POST /api/v1/widget/upload` accepts JPG, PNG, PDF, MP4; rejects others with 400
- [ ] Upload returns `{ mediaUrl, mediaType }`
- [ ] Frontend shows upload progress bar (%) during upload
- [ ] Attached image shown as thumbnail in input area before send
- [ ] Sent image messages render as `<img>` inline
- [ ] Sent video messages render as `<video controls>`
- [ ] Sent PDF messages render as download link
- [ ] Inbound media from socket `inbound_message` renders correctly
- [ ] Files over size limit show error message; upload does not proceed
