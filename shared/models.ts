export type HouseholdMemberSlug = "misiek" | "miska";
export type HouseholdMember = {
  id: string;
  name: string;
  slug: HouseholdMemberSlug;
};
export type TaskAssignment = "anyone" | HouseholdMemberSlug | "both";
export type RecurrenceUnit = "day" | "week" | "month";
export type TaskRecurrence = { unit: RecurrenceUnit; interval: number };

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  assignment: TaskAssignment;
  recurrence: TaskRecurrence | null;
  recurrenceSeriesId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CreateTaskInput = {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  assignment?: TaskAssignment;
  recurrence?: TaskRecurrence | null;
};
export type UpdateTaskInput = {
  title?: string;
  notes?: string | null;
  dueDate?: string | null;
  completed?: boolean;
  sortOrder?: number;
  assignment?: TaskAssignment;
  recurrence?: TaskRecurrence | null;
};
export type TaskStatsMember = HouseholdMember & { count: number };
export type TaskActivity = {
  id: string;
  title: string;
  completedAt: string;
  member: HouseholdMember;
};
export type TaskStats = {
  days: number;
  members: TaskStatsMember[];
  sharedCount: number;
  recentActivity: TaskActivity[];
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  checked: boolean;
  checkedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
export type CreateShoppingItemInput = {
  name: string;
  allowDuplicate?: boolean;
  quantity?: string | null;
  category?: string | null;
};
export type UpdateShoppingItemInput = {
  name?: string;
  quantity?: string | null;
  category?: string | null;
  checked?: boolean;
  sortOrder?: number;
};

export type ShoppingProduct = {
  id: string;
  name: string;
  normalizedName: string;
  defaultCategory: string | null;
  timesAdded: number;
  lastAddedAt: string;
  createdAt: string;
};

export type CalendarEventType =
  | "event"
  | "appointment"
  | "guest"
  | "trip"
  | "birthday"
  | "anniversary"
  | "delivery"
  | "bill"
  | "other";
export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  startDate: string;
  endDate: string | null;
  allDay: boolean;
  createdByMemberId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};
export type CreateCalendarEventInput = {
  title: string;
  description?: string | null;
  type?: CalendarEventType;
  startDate: string;
  endDate?: string | null;
  allDay?: boolean;
};
export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>;

export type HomeDeviceState = "on" | "off" | "unavailable" | string;
export type HomeLight = {
  id: string;
  name: string;
  state: HomeDeviceState;
  available: boolean;
  brightness: number | null;
  rgb: [number, number, number] | null;
  colorTemperatureKelvin: number | null;
  minColorTemperatureKelvin: number | null;
  maxColorTemperatureKelvin: number | null;
  supportsBrightness: boolean;
  supportsColor: boolean;
  supportsColorTemperature: boolean;
};
export type HomeClimateSwitch = {
  id: string;
  name: string;
  state: HomeDeviceState;
  available: boolean;
};
export type HomeClimateSelect = {
  id: string;
  name: string;
  value: string | null;
  options: string[];
  available: boolean;
};
export type HomeClimateNumber = {
  id: string;
  name: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  unit: string | null;
  available: boolean;
};
export type HomeClimate = {
  id: "ac";
  name: string;
  state: HomeDeviceState;
  available: boolean;
  currentTemperature: number | null;
  targetTemperature: number | null;
  minTemperature: number;
  maxTemperature: number;
  temperatureStep: number;
  modes: string[];
  fanMode: string | null;
  fanModes: string[];
  swingMode: string | null;
  swingModes: string[];
  horizontalSwingMode: string | null;
  horizontalSwingModes: string[];
  switches: HomeClimateSwitch[];
  selects: HomeClimateSelect[];
  numbers: HomeClimateNumber[];
};
export type HomeMediaDevice = {
  id: "tv" | "xbox";
  name: string;
  state: HomeDeviceState;
  available: boolean;
  volume: number | null;
  muted: boolean | null;
  source: string | null;
  sources: string[];
  mediaTitle: string | null;
  supportsVolume: boolean;
  supportsMute: boolean;
  supportsSource: boolean;
  supportsCommands: boolean;
};
export type HomeScene = {
  id: string;
  name: string;
};
export type HomeStatus = {
  connected: boolean;
  message: string | null;
  updatedAt: string;
  lights: HomeLight[];
  ac: HomeClimate | null;
  tv: HomeMediaDevice | null;
  xbox: HomeMediaDevice | null;
  scenes: HomeScene[];
};
