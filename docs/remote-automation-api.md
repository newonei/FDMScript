# Remote Automation API Contract

The extension currently expects these three HTTP endpoints:

1. `POST /api/remote-automation/register`
2. `POST /api/remote-automation/poll`
3. `POST /api/remote-automation/report`

When an API key is configured, the extension sends:

```http
Authorization: Bearer <apiKey>
Content-Type: application/json
```

## Register Device

`POST /api/remote-automation/register`

Example request body:

```json
{
  "deviceId": "fdm-8e2c4cfe-0f3d-470c-b655-8e5c7e8ccf7f",
  "deviceName": "FDM Desktop",
  "extensionVersion": "0.0.0",
  "browser": "chrome",
  "manifestVersion": 3,
  "capabilities": [
    "wait",
    "waitForSelector",
    "click",
    "type",
    "select",
    "scrollIntoView",
    "press",
    "extractText",
    "extractAttribute"
  ]
}
```

Suggested success response:

```json
{
  "ok": true,
  "message": "Device registered."
}
```

## Poll Task

`POST /api/remote-automation/poll`

Example request body:

```json
{
  "deviceId": "fdm-8e2c4cfe-0f3d-470c-b655-8e5c7e8ccf7f",
  "deviceName": "FDM Desktop",
  "trigger": "manual",
  "requestedAt": "2026-04-02T13:30:00.000Z",
  "extensionVersion": "0.0.0",
  "browser": "chrome",
  "manifestVersion": 3,
  "capabilities": [
    "wait",
    "waitForSelector",
    "click",
    "type",
    "select",
    "scrollIntoView",
    "press",
    "extractText",
    "extractAttribute"
  ],
  "lastTaskId": "task-001"
}
```

Suggested empty response:

```json
{
  "message": "No pending task.",
  "task": null
}
```

Suggested task response:

```json
{
  "message": "Task claimed.",
  "nextPollInMinutes": 1,
  "task": {
    "id": "task-002",
    "title": "Read example headline",
    "url": "https://example.com/",
    "closeTabOnFinish": true,
    "waitForPageMs": 30000,
    "steps": [
      {
        "type": "waitForSelector",
        "selector": "h1",
        "timeoutMs": 10000,
        "visible": true
      },
      {
        "type": "extractText",
        "selector": "h1",
        "key": "headline"
      }
    ],
    "metadata": {
      "jobId": "backend-job-77"
    }
  }
}
```

PDD publish task example:

```json
{
  "message": "Task claimed.",
  "task": {
    "id": "pdd-publish-001",
    "mode": "pddPublishProduct",
    "title": "PDD publish product",
    "url": "https://mms.pinduoduo.com/goods/category",
    "waitForPageMs": 30000,
    "closeTabOnFinish": false,
    "pddPublish": {
      "categoryKeyword": "运动/瑜伽/健身/球类>瑜伽装备>瑜伽垫",
      "categorySelectionMode": "first",
      "title": "天然橡胶防滑瑜伽垫 加宽加厚初学者健身垫",
      "carouselImages": [
        "C:\\\\images\\\\pdd\\\\carousel-1.jpg",
        "C:\\\\images\\\\pdd\\\\carousel-2.jpg"
      ],
      "introVideoPath": "C:\\\\images\\\\pdd\\\\intro-video.mp4",
      "detailImages": [
        "C:\\\\images\\\\pdd\\\\detail-1.jpg",
        "C:\\\\images\\\\pdd\\\\detail-2.jpg"
      ],
      "specs": [
        {
          "name": "颜色",
          "values": ["粉色", "黑色"]
        },
        {
          "name": "尺寸",
          "values": ["183x61cm", "200x80cm"]
        }
      ],
      "skuRows": [
        {
          "specs": ["粉色", "183x61cm"],
          "stock": 100,
          "groupPrice": 59.9,
          "singlePrice": 69.9,
          "previewImage": "C:\\\\images\\\\pdd\\\\pink-183.jpg",
          "skuCode": "PINK-183",
          "enabled": true
        },
        {
          "specs": ["黑色", "200x80cm"],
          "stock": 60,
          "groupPrice": 79.9,
          "singlePrice": 89.9,
          "previewImage": "C:\\\\images\\\\pdd\\\\black-200.jpg",
          "skuCode": "BLACK-200",
          "enabled": true
        }
      ]
    },
    "metadata": {
      "channel": "pdd"
    }
  }
}
```

## Report Result

`POST /api/remote-automation/report`

Example request body:

```json
{
  "deviceId": "fdm-8e2c4cfe-0f3d-470c-b655-8e5c7e8ccf7f",
  "deviceName": "FDM Desktop",
  "reportedAt": "2026-04-02T13:31:02.000Z",
  "result": {
    "taskId": "task-002",
    "source": "remote",
    "status": "success",
    "startedAt": "2026-04-02T13:30:58.000Z",
    "finishedAt": "2026-04-02T13:31:02.000Z",
    "pageUrl": "https://example.com/",
    "pageTitle": "Example Domain",
    "extracted": {
      "headline": "Example Domain"
    },
    "logs": [
      "Started task task-002 on https://example.com/",
      "Step 1: waitForSelector",
      "Step 2: extractText",
      "Task completed successfully."
    ],
    "metadata": {
      "jobId": "backend-job-77"
    }
  }
}
```

Suggested success response:

```json
{
  "ok": true,
  "message": "Result accepted."
}
```

## Supported Step Types

The extension currently supports these task steps:

- `wait`
- `waitForSelector`
- `click`
- `type`
- `select`
- `scrollIntoView`
- `press`
- `extractText`
- `extractAttribute`

It also supports the dedicated task mode:

- `mode: "pddPublishProduct"`

## Notes

- The extension currently targets `http://*/*` and `https://*/*`.
- Remote tasks should send declarative JSON steps instead of JavaScript source.
- The current implementation runs one task per poll response.
- Local image and video uploads are implemented through the extension `debugger` permission so the task can pass absolute local file paths.
- When a PDD video upload triggers the crop dialog, the extension will automatically click `确认` and continue.
