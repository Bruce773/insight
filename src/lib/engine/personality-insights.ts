/**
 * Psychological insights for Big Five personality traits based on leading research.
 * References:
 * - Costa & McCrae (1992): NEO-PI-R handbook
 * - Roberts et al. (2007): "Conscientiousness in personality"
 * - Hogan & Hogan (2001): "Assessing leadership"
 * - Ozer & Benet-Martínez (2006): "Personality and the prediction of consequential outcomes"
 * - Donnellan et al. (2006): "Mini-IPIP validation"
 * - Johnson (2014): "IPIP-NEO-120 development"
 */

export interface TraitInsight {
  domain: string;
  shortDescription: string;
  lowScoreProfile: {
    description: string;
    characteristics: string[];
    workImplications: string[];
  };
  mediumScoreProfile: {
    description: string;
    characteristics: string[];
    workImplications: string[];
  };
  highScoreProfile: {
    description: string;
    characteristics: string[];
    workImplications: string[];
  };
  researchContext: string;
}

export type TraitScoreLevel = "low" | "medium" | "high";

function categorizeScore(score: number): TraitScoreLevel {
  if (score < 0.33) return "low";
  if (score < 0.67) return "medium";
  return "high";
}

export const PERSONALITY_INSIGHTS: Record<string, TraitInsight> = {
  Neuroticism: {
    domain: "Neuroticism",
    shortDescription:
      "The tendency to experience negative emotions such as anxiety, sadness, irritability, and self-doubt.",
    lowScoreProfile: {
      description:
        "You tend to remain calm and composed, handling stress and adversity with emotional resilience.",
      characteristics: [
        "Emotionally stable and even-tempered",
        "Comfortable with uncertainty and pressure",
        "Quick to recover from setbacks",
        "Generally optimistic outlook",
        "Confident in your abilities",
      ],
      workImplications: [
        "Well-suited for high-pressure roles and crisis management",
        "Likely to maintain focus during challenges",
        "May project calm to others, building confidence in teams",
        "Can handle feedback and criticism constructively",
      ],
    },
    mediumScoreProfile: {
      description: "You experience emotions in a balanced way, neither avoiding nor being overwhelmed by them.",
      characteristics: [
        "Moderate emotional reactivity to situations",
        "Can manage stress with appropriate coping strategies",
        "Realistic view of challenges and setbacks",
        "Occasional anxiety or self-doubt, but manageable",
        "Variable mood depending on circumstances",
      ],
      workImplications: [
        "Flexible approach to different work demands",
        "Can adapt emotional responses to context",
        "May benefit from stress management techniques",
        "Likely to perform well in most role conditions",
      ],
    },
    highScoreProfile: {
      description: "You experience emotions intensely and may tend toward negative feelings like worry or sadness.",
      characteristics: [
        "Quick to feel anxious, worried, or upset",
        "Sensitive to perceived criticism",
        "May ruminate on negative thoughts or past events",
        "Natural vigilance to potential problems",
        "Rich emotional life and empathetic responses",
      ],
      workImplications: [
        "May thrive in roles where emotional awareness is valued (counseling, creative work, mentoring)",
        "Likely motivated to avoid errors and prepare thoroughly",
        "Could benefit from roles with predictable structures and clear expectations",
        "May excel in empathy-requiring roles like customer support or healthcare",
      ],
    },
    researchContext:
      "Neuroticism predicts vulnerability to stress, anxiety disorders, and depression (Roberts et al., 2007). Lower neuroticism correlates with better health outcomes and life satisfaction. However, some neuroticism can motivate careful preparation and risk awareness.",
  },

  Extraversion: {
    domain: "Extraversion",
    shortDescription:
      "The tendency to seek social interaction, stimulation, and assertiveness in group settings.",
    lowScoreProfile: {
      description:
        "You prefer smaller social circles and quieter environments, drawing energy from solitude and focused work.",
      characteristics: [
        "Prefer working independently or in small groups",
        "Comfortable with quiet reflection and deep focus",
        "Often thoughtful before speaking",
        "May be perceived as reserved or private",
        "Enjoy one-on-one interactions more than large groups",
      ],
      workImplications: [
        "Well-suited for roles requiring deep concentration (research, writing, technical work)",
        "Can excel in independent projects with minimal oversight",
        "May prefer written communication over public speaking",
        "Often thorough and careful in their work",
        "Can be excellent listeners in team settings despite quietness",
      ],
    },
    mediumScoreProfile: {
      description: "You balance social engagement with quiet time, adapting your social approach to context.",
      characteristics: [
        "Flexible in social situations, participating when appropriate",
        "Comfortable both in groups and alone",
        "Can initiate interactions but don't require constant stimulation",
        "Situational talker—more chatty in some contexts than others",
        "Moderate energy levels",
      ],
      workImplications: [
        "Adaptable to various team and work environments",
        "Can handle both collaborative and independent work",
        "May serve well as a bridge between introverted and extraverted team members",
        "Likely to adjust communication style based on audience",
      ],
    },
    highScoreProfile: {
      description: "You are energized by social interaction and are typically active, outgoing, and assertive.",
      characteristics: [
        "Seek out social interaction and group activities",
        "Energized by meetings, networking, and collaboration",
        "Often talkative and comfortable being the center of attention",
        "Take initiative and are quick to volunteer",
        "Enjoy stimulating, varied environments",
      ],
      workImplications: [
        "Excel in roles requiring networking, sales, or public interaction",
        "Often natural leaders and team motivators",
        "May thrive in dynamic, varied roles with frequent collaboration",
        "Well-suited for roles involving presentation or client-facing work",
        "Can energize teams and promote positive group morale",
      ],
    },
    researchContext:
      "Extraversion is linked to leadership emergence, social success, and subjective well-being (Hogan & Hogan, 2001). It predicts performance in team and social roles but doesn't guarantee success—different roles require different optimal levels of extraversion.",
  },

  "Openness to Experience": {
    domain: "Openness to Experience",
    shortDescription:
      "The tendency to seek intellectual stimulation, appreciate diverse perspectives, and embrace new experiences.",
    lowScoreProfile: {
      description:
        "You prefer established practices and familiar approaches, valuing proven methods over untested ideas.",
      characteristics: [
        "Prefer structured, concrete information over abstract concepts",
        "Value tradition and established methods",
        "Practical focus on immediate, tangible outcomes",
        "May be skeptical of radical change or new theories",
        "Comfortable with routine and predictable work",
      ],
      workImplications: [
        "Thrive in roles with clear procedures and established systems",
        "Likely to maintain consistency and reliability in execution",
        "May excel in operational roles and specialized expertise",
        "Can be counted on to follow through on established processes",
        "May resist change initially but become consistent performers once adapted",
      ],
    },
    mediumScoreProfile: {
      description:
        "You balance appreciation for practical reliability with selective openness to new ideas and approaches.",
      characteristics: [
        "Open to new ideas when they're well-reasoned",
        "Mix of creative thinking and practical grounding",
        "Moderate curiosity about abstract concepts",
        "Some flexibility toward change, with evaluation of benefits",
        "Interested in learning but also value proven methods",
      ],
      workImplications: [
        "Adaptable to both stable and innovative work environments",
        "Can contribute both practical and creative perspectives",
        "Likely to thoughtfully evaluate innovations before adoption",
        "May bridge between traditional and progressive approaches",
      ],
    },
    highScoreProfile: {
      description:
        "You are intellectually curious, creatively inclined, and open to exploring novel ideas and experiences.",
      characteristics: [
        "Seek intellectual stimulation and new learning opportunities",
        "Drawn to creative, artistic, or innovative pursuits",
        "Comfortable with abstract thinking and complex ideas",
        "Often curious about diverse perspectives and cultures",
        "Thrive in environments with change and new challenges",
      ],
      workImplications: [
        "Well-suited for creative roles, research, strategy, or innovation",
        "May excel in complex problem-solving and intellectual work",
        "Often contribute novel ideas and perspectives to teams",
        "Adaptable to change and new technologies",
        "Can help organizations stay forward-thinking, though may need grounding in implementation details",
      ],
    },
    researchContext:
      "Openness predicts creativity, learning ability, and adaptation to change (Ozer & Benet-Martínez, 2006). It's associated with higher education attainment and intellectual achievement. High openness can enhance innovation but may correlate with difficulty in execution of routine tasks.",
  },

  Agreeableness: {
    domain: "Agreeableness",
    shortDescription:
      "The tendency to prioritize harmony, cooperation, and concern for others' well-being in interactions.",
    lowScoreProfile: {
      description: "You are independent and direct, comfortable with competition and prioritizing objectives.",
      characteristics: [
        "Direct and frank in communication",
        "Comfortable with conflict and competition",
        "Independent decision-maker",
        "Skeptical and analytical about others' claims",
        "Assertive about your own needs and viewpoints",
      ],
      workImplications: [
        "Well-suited for roles requiring tough decisions or competitive environments",
        "Often effective negotiators and advocates",
        "Can push back on ineffective processes or ideas",
        "May excel in roles requiring critical evaluation or challenge",
        "Natural leaders in adversarial or competitive contexts",
      ],
    },
    mediumScoreProfile: {
      description: "You balance cooperation with self-advocacy, capable of both teamwork and independent judgment.",
      characteristics: [
        "Cooperative when goals align, but willing to advocate for own needs",
        "Balanced in conflict—neither avoiding nor seeking it",
        "Can be diplomatic without being overly accommodating",
        "Consider both others' and own perspectives",
        "Situationally adaptable in collaboration style",
      ],
      workImplications: [
        "Flexible team player who maintains integrity",
        "Can navigate complex interpersonal dynamics",
        "Likely to be effective in both consensus and decisive roles",
        "Can balance collaboration with accountability",
      ],
    },
    highScoreProfile: {
      description: "You are compassionate and cooperative, valuing harmony and naturally attuned to others' needs.",
      characteristics: [
        "Prioritize harmony and avoid conflict",
        "Genuinely interested in others' well-being",
        "Cooperative and willing to help teammates",
        "Trusting and forgiving of others",
        "May suppress own needs to maintain relationships",
      ],
      workImplications: [
        "Excel in team-oriented and service-focused roles",
        "Natural mentors, counselors, or collaborators",
        "Build strong interpersonal relationships and team cohesion",
        "Often sought out as mediators or supporters",
        "May need to develop assertiveness skills for leadership roles; watch for over-accommodation",
      ],
    },
    researchContext:
      "Agreeableness predicts teamwork, cooperation, and subjective well-being (Roberts et al., 2007). Lower agreeableness correlates with leadership emergence in competitive contexts. Very high agreeableness may sometimes lead to being taken advantage of or difficulty making tough decisions.",
  },

  Conscientiousness: {
    domain: "Conscientiousness",
    shortDescription:
      "The tendency to be organized, disciplined, and committed to achieving goals and maintaining standards.",
    lowScoreProfile: {
      description:
        "You prefer flexibility and spontaneity, with a relaxed approach to structure and rigid planning.",
      characteristics: [
        "Flexible and adaptable to changing circumstances",
        "May postpone decisions or tasks without stress",
        "Comfortable working without detailed plans",
        "Spontaneous and responsive rather than planned",
        "May find excessive structure constraining",
      ],
      workImplications: [
        "Well-suited for creative, improvisational, or rapidly changing roles",
        "Adaptable to unexpected challenges and pivots",
        "May excel in entrepreneurial or exploratory work",
        "Often good at improvisation and thinking on feet",
        "May struggle with routine, repetitive work; could benefit from dynamic roles",
      ],
    },
    mediumScoreProfile: {
      description: "You balance planning with flexibility, organizing work while remaining adaptable to change.",
      characteristics: [
        "Generally organized with selective planning",
        "Can maintain standards without obsessiveness",
        "Balance between structure and spontaneity",
        "Usually reliable, though not obsessively so",
        "Adapt level of structure to task demands",
      ],
      workImplications: [
        "Flexible performer who can organize when needed",
        "Adaptable to different work styles and structures",
        "Can manage both complex projects and dynamic environments",
        "Likely reliable team member with good work-life balance",
      ],
    },
    highScoreProfile: {
      description: "You are organized, disciplined, and committed to meeting high standards and completing goals.",
      characteristics: [
        "Well-organized and detail-oriented",
        "Disciplined approach to work and self-care",
        "Committed to achieving goals and standards",
        "Reliable and responsible in commitments",
        "May experience stress when systems break down or standards slip",
      ],
      workImplications: [
        "Thrive in roles requiring organization, planning, and execution",
        "Often natural project managers and quality leaders",
        "Consistent performers who can be counted on for reliability",
        "Excel in roles with clear goals and measurable outcomes",
        "Natural at building and maintaining systems, though may need to balance with flexibility for rapid change",
      ],
    },
    researchContext:
      "Conscientiousness is the strongest personality predictor of job performance across diverse occupations (Roberts et al., 2007). It predicts longevity, health, and life achievement. It's associated with delaying gratification, perseverance, and responsibility.",
  },
};

export function getTraitInsight(domain: string): TraitInsight | null {
  return PERSONALITY_INSIGHTS[domain] || null;
}

export function getProfileInsight(domain: string, score: number) {
  const insight = getTraitInsight(domain);
  if (!insight) return null;
  const level = categorizeScore(score);
  return { insight, level, profile: insight[`${level}ScoreProfile`] };
}

/**
 * Returns interpretive guidance for a score on a 0-1 scale.
 * This is for display purposes; actual interpretation requires context.
 */
export function interpretScore(score: number): string {
  if (score < 0.25) return "notably low";
  if (score < 0.4) return "low to moderate";
  if (score < 0.6) return "moderate";
  if (score < 0.75) return "moderate to high";
  return "notably high";
}
