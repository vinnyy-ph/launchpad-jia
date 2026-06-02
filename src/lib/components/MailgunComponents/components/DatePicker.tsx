import { DayPicker, getDefaultClassNames } from "react-day-picker";
import "react-day-picker/style.css";
import "@/lib/styles/day-picker.scss";

function MyDatePicker({
  selected,
  onSelect,
}: {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
}) {
  const today = new Date();
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      animate
      mode="single"
      disabled={{ before: today }}
      showOutsideDays
      selected={selected}
      onSelect={onSelect}
      navLayout="around"
      timeZone="Asia/Manila"
      classNames={{
        caption_label: `${defaultClassNames.caption_label} month`,
        weekdays: `weekdays`,
        weeks: `weeks`,
        today: `today`,
        chevron: `${defaultClassNames.chevron} arrow`,
      }}
    />
  );
}
export default MyDatePicker;
