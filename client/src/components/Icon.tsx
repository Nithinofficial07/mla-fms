import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material';
import {
  AccountBalance, AdminPanelSettings, Add, AddCircleOutline, Apartment, ArrowBack, ArrowDownward, ArrowForward, ArrowUpward,
  Assessment, AssignmentInd, AttachFile, AttachMoney, Autorenew, Badge, BarChart, Bolt, Business, CameraAlt,
  Cancel, Category, Checklist, CheckCircle, ChevronLeft, ChevronRight, Circle, Close, CloudDone, CloudOff,
  CloudUpload, Comment, Construction, ContentCopy, Cottage, Dashboard, DarkMode, Delete, Description,
  DocumentScanner, Download, Drafts, EditNote, ErrorOutline, Event, EventAvailable, ExpandLess, ExpandMore, FactCheck, FiberManualRecord,
  FiberNew, FilterList, Flag, FlightTakeoff, FolderCopy, FolderOff, FolderShared, Forward, ForwardToInbox, Grass, Group, HelpOutline, History,
  Home, HourglassEmpty, Inbox, Info, Insights, Keyboard, KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight, Label, LightMode, ListAlt, LocationCity, Lock, Mail, MarkEmailRead, Menu, MoreVert, NoteAdd, Notes, Notifications, NotificationsNone,
  OpenInNew, Person, PersonAdd, Phone, PhotoCamera, PhotoLibrary, PictureAsPdf, Place, PriorityHigh, Print, Public, RadioButtonUnchecked, Remove,
  ReportProblem, Rotate90DegreesCw, SearchOff, Search, Send, Settings, Spa, SwapHoriz,
  CalendarMonth, DriveFileMove, Edit, FormatAlignCenter, FormatAlignLeft, FormatAlignRight, FormatBold, FormatClear, FormatColorFill, FormatColorText, FormatItalic, FormatListBulleted, FormatListNumbered, FormatStrikethrough, FormatUnderlined, Fullscreen, FullscreenExit, Groups, Redo, Refresh, Share, TextDecrease, TextIncrease, Undo, ViewDay, ViewWeek,
  TableView, TaskAlt, Timeline, Today, Translate, Tune, UploadFile, Videocam, ViewKanban, ViewList, ViewModule, Visibility, VisibilityOff, Warning,
} from '@mui/icons-material';

/** Explicit registry — keeps the production bundle from pulling every MUI icon. */
const REGISTRY: Record<string, ComponentType<SvgIconProps>> = {
  AccountBalance, AdminPanelSettings, Add, AddCircleOutline, Apartment, ArrowBack, ArrowDownward, ArrowForward, ArrowUpward,
  Assessment, AssignmentInd, AttachFile, AttachMoney, Autorenew, Badge, BarChart, Bolt, Business, CameraAlt,
  Cancel, Category, Checklist, CheckCircle, ChevronLeft, ChevronRight, Circle, Close, CloudDone, CloudOff,
  CloudUpload, Comment, Construction, ContentCopy, Cottage, Dashboard, DarkMode, Delete, Description,
  DocumentScanner, Download, Drafts, EditNote, ErrorOutline, Event, EventAvailable, ExpandLess, ExpandMore, FactCheck, FiberManualRecord,
  FiberNew, FilterList, Flag, FlightTakeoff, FolderCopy, FolderOff, FolderShared, Forward, ForwardToInbox, Grass, Group, HelpOutline, History,
  Home, HourglassEmpty, Inbox, Info, Insights, Keyboard, KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight, Label, LightMode, ListAlt, LocationCity, Lock, Mail, MarkEmailRead, Menu, MoreVert, NoteAdd, Notes, Notifications, NotificationsNone,
  OpenInNew, Person, PersonAdd, Phone, PhotoCamera, PhotoLibrary, PictureAsPdf, Place, PriorityHigh, Print, Public, RadioButtonUnchecked, Remove,
  ReportProblem, Rotate90DegreesCw, SearchOff, Search, Send, Settings, Spa, SwapHoriz,
  CalendarMonth, DriveFileMove, Edit, FormatAlignCenter, FormatAlignLeft, FormatAlignRight, FormatBold, FormatClear, FormatColorFill, FormatColorText, FormatItalic, FormatListBulleted, FormatListNumbered, FormatStrikethrough, FormatUnderlined, Fullscreen, FullscreenExit, Groups, Redo, Refresh, Share, TextDecrease, TextIncrease, Undo, ViewDay, ViewWeek,
  TableView, TaskAlt, Timeline, Today, Translate, Tune, UploadFile, Videocam, ViewKanban, ViewList, ViewModule, Visibility, VisibilityOff, Warning,
};

export function Icon({ name, ...props }: { name: string } & SvgIconProps) {
  const Cmp = REGISTRY[name] ?? Circle;
  return <Cmp fontSize="small" {...props} />;
}
