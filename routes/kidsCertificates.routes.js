const express =
  require("express");

const router =
  express.Router();

const pool =
  require("../config/db");

const {
  verifyToken
} = require(
  "../middleware/auth.middleware"
);

console.log(
  "✅ kidsCertificates routes loaded"
);

router.get(
  "/my-certificates",
  verifyToken,
  async (req,res) => {

    const childId =
      Number(
        req.query.child_id
      );

    const result =
      await pool.query(
        `
        SELECT

          kc.certificate_id,

          kc.issued_at,

          c.title
            AS course_title

        FROM kids_certificates kc

        JOIN kids_courses c

        ON c.id = kc.course_id

        WHERE kc.child_id = $1

        ORDER BY kc.id DESC
        `,
        [childId]
      );

    res.json({

      success:true,

      certificates:
        result.rows

    });

  }
);

router.get(
  "/:certificateId",

  verifyToken,

  async (req,res) => {

    try {

      const certId =
        req.params.certificateId;

      const result =
        await pool.query(
          `
          SELECT

            kc.*,

            kp.child_name,

            c.title
              AS course_title

          FROM kids_certificates kc

          JOIN kids_profiles kp

          ON kp.id = kc.child_id

          JOIN kids_courses c

          ON c.id = kc.course_id

          WHERE
          kc.certificate_id = $1
          `,
          [certId]
        );

      if (
        !result.rows.length
      ) {

        return res.status(404)
        .json({

          success:false

        });

      }

      return res.json({

        success:true,

        certificate:
          result.rows[0]

      });

    }

    catch(err) {

      console.error(err);

      return res.status(500)
      .json({

        success:false

      });

    }

  }
);

module.exports = router;