import Image from 'next/image';

interface IconProps {
  name: string;
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
}

export const Icon = ({ name, width = 24, height = 24, className, alt }: IconProps) => {
  return (
    <Image
      src={`/${name}.svg`}
      alt={alt || `${name} icon`}
      width={width}
      height={height}
      className={className}
    />
  );
};

// Specific icon components matching the actual SVG files in public folder
export const GlobeIcon = ({ className }: { className?: string }) => (
  <Icon name="globeicon" width={20} height={20} className={className} />
);

export const ChevronDownIcon = ({ className }: { className?: string }) => (
  <Icon name="explorearrow" width={16} height={16} className={className} />
);

export const SendIcon = ({ className }: { className?: string }) => (
  <Icon name="send" width={56} height={56} className={className} />
);

export const ShieldIcon = ({ className }: { className?: string }) => (
  <Icon name="sheild" width={40} height={40} className={className} />
);

export const SparklesIcon = ({ className }: { className?: string }) => (
  <Icon name="sparkles" width={40} height={40} className={className} />
);

export const UsersIcon = ({ className }: { className?: string }) => (
  <Icon name="leadership" width={40} height={40} className={className} />
);

export const LightbulbIcon = ({ className }: { className?: string }) => (
  <Icon name="innovation" width={40} height={40} className={className} />
);

export const CalendarIcon = ({ className }: { className?: string }) => (
  <Icon name="calendericon" width={20} height={20} className={className} />
);

export const LocationIcon = ({ className }: { className?: string }) => (
  <Icon name="locationicon" width={20} height={20} className={className} />
);

export const KeyPeopleIcon = ({ className }: { className?: string }) => (
  <Icon name="keypeopleicon" width={20} height={20} className={className} />
);

export const SourcesIcon = ({ className }: { className?: string }) => (
  <Icon name="sources" width={24} height={24} className={className} />
);

export const StoryIcon = ({ className }: { className?: string }) => (
  <Icon name="storyicon" width={24} height={24} className={className} />
);

export const LessonsIcon = ({ className }: { className?: string }) => (
  <Icon name="lessons" width={20} height={20} className={className} />
);

export const WhyItMatteredIcon = ({ className }: { className?: string }) => (
  <Icon name="whyitmattered" width={20} height={20} className={className} />
);

export const MomentTeachesIcon = ({ className }: { className?: string }) => (
  <Icon name="momentteaches" width={24} height={24} className={className} />
);