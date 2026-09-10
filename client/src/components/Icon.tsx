import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material';
import {
  AccountBalance, AdminPanelSettings, Add, AddCircleOutline, Apartment, ArrowBack,
  Assessment, AssignmentInd, AttachFile, Autorenew, BarChart, Business, CameraAlt,
  Cancel, Category, ChevronLeft, ChevronRight, Circle, Close, CloudDone, CloudOff,
  CloudUpload, Comment, ContentCopy, Cottage, Dashboard, Delete, Description,
  DocumentScanner, Download, Drafts, EditNote, Event, ExpandLess, ExpandMore, FiberManualRecord,
  FiberNew, FilterList, Flag, FolderCopy, FolderOff, FolderShared, Forward, Grass, Group, History,
  HourglassEmpty, Inbox, Label, ListAlt, Mail, Menu, NoteAdd, Notifications, NotificationsNone,
  PersonAdd, PhotoCamera, PhotoLibrary, PictureAsPdf, Place, PriorityHigh, Print,
  ReportProblem, Rotate90DegreesCw, Search, SearchOff, Send, Settings, Spa, SwapHoriz,
  TableView, TaskAlt, Timeline, Today, Tune, UploadFile, Videocam, ViewList, Visibility,
} from '@mui/icons-material';

/** Explicit registry — keeps the production bundle from pulling every MUI icon. */
const REGISTRY: Record<string, ComponentType<SvgIconProps>> = {
  AccountBalance, AdminPanelSettings, Add, AddCircleOutline, Apartment, ArrowBack,
  Assessment, AssignmentInd, AttachFile, Autorenew, BarChart, Business, CameraAlt,
  Cancel, Category, ChevronLeft, ChevronRight, Circle, Close, CloudDone, CloudOff,
  CloudUpload, Comment, ContentCopy, Cottage, Dashboard, Delete, Description,
  DocumentScanner, Download, Drafts, EditNote, Event, ExpandLess, ExpandMore, FiberManualRecord,
  FiberNew, FilterList, Flag, FolderCopy, FolderOff, FolderShared, Forward, Grass, Group, History,
  HourglassEmpty, Inbox, Label, ListAlt, Mail, Menu, NoteAdd, Notifications, NotificationsNone,
  PersonAdd, PhotoCamera, PhotoLibrary, PictureAsPdf, Place, PriorityHigh, Print,
  ReportProblem, Rotate90DegreesCw, Search, SearchOff, Send, Settings, Spa, SwapHoriz,
  TableView, TaskAlt, Timeline, Today, Tune, UploadFile, Videocam, ViewList, Visibility,
};

export function Icon({ name, ...props }: { name: string } & SvgIconProps) {
  const Cmp = REGISTRY[name] ?? Circle;
  return <Cmp fontSize="small" {...props} />;
}
