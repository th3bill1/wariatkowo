import { useState } from "react";
import type { HouseholdMember } from "../../../shared/models";

const PROFILE_IMAGES: Record<HouseholdMember["slug"], string> = {
  misiek: "/profiles/misiek.jpg",
  miska: "/profiles/miska.jpg",
};

export function ProfileAvatar({
  member,
  className = "",
}: {
  member: HouseholdMember;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const classes = [
    "profile-avatar",
    "profile-avatar--" + member.slug,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      {!failed ? (
        <img
          alt=""
          aria-hidden="true"
          className="profile-avatar__image"
          onError={() => setFailed(true)}
          src={PROFILE_IMAGES[member.slug]}
        />
      ) : (
        <span aria-hidden="true" className="profile-avatar__fallback">
          {member.name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
