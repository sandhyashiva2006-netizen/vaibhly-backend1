const express = require("express");
const router = express.Router();

const {
  verifyToken
} = require("../middleware/auth.middleware");

/**
 * DEMO COURSES
 */

const demoCourses = [

  {
    id: 1,
    title: "Coding for Kids Beginner",
    description:
      "Learn coding basics with fun missions.",

    class_level: "4-8",
    subject: "Coding",
    path: "smart_skills",

    thumbnail: "",
    progress: 0
  },

  {
    id: 2,
    title: "Daily Quiz Challenge",
    description:
      "Fun quiz challenges every day.",

    class_level: "1-10",
    subject: "Quiz",
    path: "fun_challenges",

    thumbnail: "",
    progress: 0
  },

  {
    id: 3,
    title: "Class 5 Social Studies",
    description:
      "Interactive social studies lessons.",

    class_level: "5",
    subject: "Social Studies",
    path: "school_booster",

    thumbnail: "",
    progress: 0
  }

];

/**
 * GET /api/kids/courses
 */

router.get(
  "/courses",
  async (req, res) => {

    return res.json({
      success: true,
      courses: demoCourses
    });

  }
);

/**
 * GET /api/kids/courses/:id
 */

router.get(
  "/courses/:id",
  async (req, res) => {

    const courseId =
      Number(req.params.id);

    const course =
      demoCourses.find(
        c => c.id === courseId
      );

    if (!course) {

      return res.status(404).json({
        success: false,
        message: "Course not found"
      });

    }

    return res.json({
      success: true,

      course,

      lessons: [

        {
          id: 1,
          title:
            "Introduction Lesson",

          content:
            "Welcome to Vaibhly Kids!"
        },

        {
          id: 2,
          title:
            "Practice Activity",

          content:
            "Complete the fun activity."
        }

      ]

    });

  }
);

module.exports = router;