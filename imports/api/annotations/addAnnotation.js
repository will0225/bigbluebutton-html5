import { check } from 'meteor/check';

const ANNOTATION_TYPE_TEXT = 'text';
const ANNOTATION_TYPE_PENCIL = 'pencil';

const DEFAULT_TEXT_WIDTH = 30;
const DEFAULT_TEXT_HEIGHT = 20;

// line, triangle, ellipse, rectangle
function handleCommonAnnotation(meetingId, whiteboardId, userId, annotation) {
  const {
    id, status, annotationType, annotationInfo, wbId, position,
  } = annotation;

  const selector = {
    meetingId,
    id,
    userId,
  };

  const modifier = {
    $set: {
      whiteboardId,
      meetingId,
      id,
      status,
      annotationType,
      annotationInfo,
      wbId,
    },
    $setOnInsert: {
      position,
    },
    $inc: { version: 1 },
  };

  return { selector, modifier };
}

function handleTextUpdate(meetingId, whiteboardId, userId, annotation) {
  const {
    id, status, annotationType, annotationInfo, wbId, position,
  } = annotation;

  const { textBoxWidth, textBoxHeight, calcedFontSize } = annotationInfo;
  const useDefaultSize = (textBoxWidth === 0 && textBoxHeight === 0)
    || textBoxWidth < calcedFontSize
    || textBoxHeight < calcedFontSize;

  if (useDefaultSize) {
    annotationInfo.textBoxWidth = DEFAULT_TEXT_WIDTH;
    annotationInfo.textBoxHeight = DEFAULT_TEXT_HEIGHT;

    if (100 - annotationInfo.x < DEFAULT_TEXT_WIDTH) {
      annotationInfo.textBoxWidth = 100 - annotationInfo.x;
    }
    if (100 - annotationInfo.y < DEFAULT_TEXT_HEIGHT) {
      annotationInfo.textBoxHeight = 100 - annotationInfo.y;
    }
  }

  const selector = {
    meetingId,
    id,
    userId,
  };

  annotationInfo.text = annotationInfo.text.replace(/[\r]/g, '\n');

  const modifier = {
    $set: {
      whiteboardId,
      meetingId,
      id,
      status,
      annotationType,
      annotationInfo,
      wbId,
    },
    $setOnInsert: {
      position,
    },
    $inc: { version: 1 },
  };

  return { selector, modifier };
}

function handlePencilUpdate(meetingId, whiteboardId, userId, annotation) {
  const DRAW_START = 'DRAW_START';
  const DRAW_UPDATE = 'DRAW_UPDATE';
  const DRAW_END = 'DRAW_END';

  const {
    id, status, annotationType, annotationInfo, wbId, position,
  } = annotation;

  const baseSelector = {
    meetingId,
    id,
    userId,
    whiteboardId,
  };

  let baseModifier;
  switch (status) {
    case DRAW_START:
      // on start we split the points

      // create the 'pencil_base'
      // TODO: find and removed unused props (chunks, version, etc)
      baseModifier = {
        $set: {
          id,
          userId,
          meetingId,
          whiteboardId,
          position,
          status,
          annotationType,
          annotationInfo,
          wbId,
          version: 1,
        },
      };
      break;
    case DRAW_UPDATE:
      baseModifier = {
        $push: {
          'annotationInfo.points': { $each: annotationInfo.points },
        },
        $set: {
          status,
        },
        $inc: { version: 1 },
      };
      break;
    case DRAW_END:
      // Updating the main pencil object with the final info
      baseModifier = {
        $set: {
          whiteboardId,
          meetingId,
          id,
          status,
          annotationType,
          annotationInfo,
          wbId,
          position,
        },
        $inc: { version: 1 },
      };
      break;
    default:
      break;
  }

  return { selector: baseSelector, modifier: baseModifier };
}

export default function addAnnotation(meetingId, whiteboardId, userId, annotation) {
  check(meetingId, String);
  check(whiteboardId, String);
  check(annotation, Object);

  switch (annotation.annotationType) {
    case ANNOTATION_TYPE_TEXT:
      return handleTextUpdate(meetingId, whiteboardId, userId, annotation);
    case ANNOTATION_TYPE_PENCIL:
      return handlePencilUpdate(meetingId, whiteboardId, userId, annotation);
    default:
      return handleCommonAnnotation(meetingId, whiteboardId, userId, annotation);
  }
}
