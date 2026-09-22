import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material';
import {
  AccountBalance, AdminPanelSettings, Add, AddCircleOutline, Apartment, ArrowBack, ArrowDownward, ArrowForward, ArrowUpward,
  Assessment, AssignmentInd, AttachFile, AttachMoney, Autorenew, BarChart, Business, CameraAlt,
  Cancel, Category, CheckCircle, ChevronLeft, ChevronRight, Circle, Close, CloudDone, CloudOff,
  CloudUpload, Comment, ContentCopy, Cottage, Dashboard, DarkMode, Delete, Description,
  DocumentScanner, Download, Drafts, EditNote, ErrorOutline, Event, ExpandLess, ExpandMore, FiberManualRecord,
  FiberNew, FilterList, Flag, FolderCopy, FolderOff, FolderShared, Forward, ForwardToInbox, Grass, Group, History,
  HourglassEmpty, Inbox, Insights, Keyboard, KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight, Label, LightMode, ListAlt, Lock, Mail, Menu, MoreVert, NoteAdd, Notifications, NotificationsNone,
  OpenInNew, Person, PersonAdd, Phone, PhotoCamera, PhotoLibrary, PictureAsPdf, Place, PriorityHigh, Print, Remove,
  ReportProblem, Rotate90DegreesCw, SearchOff, Search, Send, Settings, Spa, SwapHoriz,
  TableView, TaskAlt, Timeline, Today, Tune, UploadFile, Videocam, ViewKanban, ViewList, ViewModule, Visibility, VisibilityOff, Warning,
} from '@mui/icons-material';

/** Explicit registry — keeps the production bundle from pulling every MUI icon. */
const REGISTRY: Record<string, ComponentType<SvgIconProps>> = {
  AccountBalance, AdminPanelSettings, Add, AddCircleOutline, Apartment, ArrowBack, ArrowDownward, ArrowForward, ArrowUpward,
  Assessment, AssignmentInd, AttachFile, AttachMoney, Autorenew, BarChart, Business, CameraAlt,
  Cancel, Category, CheckCircle, ChevronLeft, ChevronRight, Circle, Close, CloudDone, CloudOff,
  CloudUpload, Comment, ContentCopy, Cottage, Dashboard, DarkMode, Delete, Description,
  DocumentScanner, Download, Drafts, EditNote, ErrorOutline, Event, ExpandLess, ExpandMore, FiberManualRecord,
  FiberNew, FilterList, Flag, FolderCopy, FolderOff, FolderShared, Forward, ForwardToInbox, Grass, Group, History,
  HourglassEmpty, Inbox, Insights, Keyboard, KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight, Label, LightMode, ListAlt, Lock, Mail, Menu, MoreVert, NoteAdd, Notifications, NotificationsNone,
  OpenInNew, Person, PersonAdd, Phone, PhotoCamera, PhotoLibrary, PictureAsPdf, Place, PriorityHigh, Print, Remove,
  ReportProblem, Rotate90DegreesCw, SearchOff, Search, Send, Settings, Spa, SwapHoriz,
  TableView, TaskAlt, Timeline, Today, Tune, UploadFile, Videocam, ViewKanban, ViewList, ViewModule, Visibility, VisibilityOff, Warning,
};

export function Icon({ name, ...props }: { name: string } & SvgIconProps) {
  const Cmp = REGISTRY[name] ?? Circle;
  return <Cmp fontSize="small" {...props} />;
}
