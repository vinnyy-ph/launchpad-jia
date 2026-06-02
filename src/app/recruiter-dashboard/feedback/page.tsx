import Feedback from "@/lib/components/screens/Feedback";
import HeaderBar from "@/lib/PageComponent/HeaderBar";

export default function () {
  return (
    <>
      <HeaderBar
        activeLink="Feedback"
        currentPage="Overview"
        icon="la la-comment-alt"
      />
      <Feedback />
    </>
  );
}
